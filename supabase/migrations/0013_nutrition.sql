-- ============================================================================
-- Brabus Fit — Nutrición (planes de alimentación)
-- ============================================================================
-- Mismo modelo que las rutinas:
-- - Plantillas: planes del coach sin cliente, en carpetas propias
--   (nutrition_folders). Nadie más las ve.
-- - Plan de cliente: copia independiente asignada a una ficha (client_id).
--   Un cliente puede tener varios; el coach marca uno como vigente.
-- - El alumno lo ve con acceso activo a la app. Si se corta el acceso, se
--   queda con una copia propia (igual que las rutinas).
-- - Estructura: plan → comidas → opciones (A, B…) → alimentos (cantidad,
--   unidad y kcal/macros opcionales). Un único día por plan. Objetivos e
--   indicaciones generales opcionales.
-- - Hoy solo los coaches crean planes (save_full_plan lo valida); el modelo
--   ya admite planes propios del alumno (owner = alumno) para el futuro.
-- ============================================================================

create table if not exists public.nutrition_folders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists nutrition_folders_owner_idx on public.nutrition_folders (owner_id);

create table if not exists public.nutrition_plans (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  folder_id       uuid references public.nutrition_folders(id) on delete set null,
  client_id       uuid references public.coach_students(id) on delete cascade,
  name            text not null,
  guidelines      text,
  target_kcal     numeric,
  target_protein  numeric,
  target_carbs    numeric,
  target_fat      numeric,
  target_water_l  numeric,
  is_current      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists nutrition_plans_owner_idx on public.nutrition_plans (owner_id);
create index if not exists nutrition_plans_client_idx on public.nutrition_plans (client_id);

create table if not exists public.nutrition_meals (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.nutrition_plans(id) on delete cascade,
  name       text not null,
  time_label text,
  position   int not null default 0
);
create index if not exists nutrition_meals_plan_idx on public.nutrition_meals (plan_id);

create table if not exists public.nutrition_options (
  id       uuid primary key default gen_random_uuid(),
  meal_id  uuid not null references public.nutrition_meals(id) on delete cascade,
  position int not null default 0
);
create index if not exists nutrition_options_meal_idx on public.nutrition_options (meal_id);

create table if not exists public.nutrition_items (
  id        uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.nutrition_options(id) on delete cascade,
  food      text not null,
  amount    text,
  unit      text,
  kcal      numeric,
  protein   numeric,
  carbs     numeric,
  fat       numeric,
  position  int not null default 0
);
create index if not exists nutrition_items_option_idx on public.nutrition_items (option_id);

-- Planes de cliente: la ficha es del dueño y no van en carpetas.
create or replace function public.nutrition_plans_check_client()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is null then
    new.is_current := false;
    return new;
  end if;
  new.folder_id := null;
  if (tg_op = 'INSERT' or new.client_id is distinct from old.client_id)
     and not exists (
       select 1 from public.coach_students
        where id = new.client_id and coach_id = new.owner_id
     ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;
  return new;
end; $$;

drop trigger if exists nutrition_plans_check_client on public.nutrition_plans;
create trigger nutrition_plans_check_client
  before insert or update of client_id, folder_id, is_current on public.nutrition_plans
  for each row execute function public.nutrition_plans_check_client();

-- Acceso -----------------------------------------------------------------------------
create or replace function public.has_plan_access(p_plan_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.nutrition_plans p
    where p.id = p_plan_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.coach_students c
           where c.id = p.client_id and c.student_id = auth.uid() and c.status = 'active'
        )
      )
  );
$$;

create or replace function public.is_plan_owner(p_plan_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.nutrition_plans where id = p_plan_id and owner_id = auth.uid());
$$;

create or replace function public.meal_plan(p_meal_id uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select plan_id from public.nutrition_meals where id = p_meal_id;
$$;

create or replace function public.option_plan(p_option_id uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select m.plan_id from public.nutrition_options o
    join public.nutrition_meals m on m.id = o.meal_id
   where o.id = p_option_id;
$$;

alter table public.nutrition_folders enable row level security;
alter table public.nutrition_plans   enable row level security;
alter table public.nutrition_meals   enable row level security;
alter table public.nutrition_options enable row level security;
alter table public.nutrition_items   enable row level security;

drop policy if exists nutrition_folders_all on public.nutrition_folders;
create policy nutrition_folders_all on public.nutrition_folders for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists nutrition_plans_select on public.nutrition_plans;
create policy nutrition_plans_select on public.nutrition_plans for select
  using (public.has_plan_access(id));
drop policy if exists nutrition_plans_update on public.nutrition_plans;
create policy nutrition_plans_update on public.nutrition_plans for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists nutrition_plans_delete on public.nutrition_plans;
create policy nutrition_plans_delete on public.nutrition_plans for delete
  using (owner_id = auth.uid());
-- Altas por RPC (save_full_plan / copy_nutrition_plan).

drop policy if exists nutrition_meals_select on public.nutrition_meals;
create policy nutrition_meals_select on public.nutrition_meals for select
  using (public.has_plan_access(plan_id));
drop policy if exists nutrition_options_select on public.nutrition_options;
create policy nutrition_options_select on public.nutrition_options for select
  using (public.has_plan_access(public.meal_plan(meal_id)));
drop policy if exists nutrition_items_select on public.nutrition_items;
create policy nutrition_items_select on public.nutrition_items for select
  using (public.has_plan_access(public.option_plan(option_id)));
-- Comidas, opciones y alimentos se escriben solo por RPC.

-- Guardar plan completo ----------------------------------------------------------------
-- p_data: { name, folder_id?, client_id? (solo al crear), guidelines?, target_kcal?,
--   target_protein?, target_carbs?, target_fat?, target_water_l?,
--   meals: [{ name, time_label?, options: [{ items: [{ food, amount?, unit?, kcal?,
--   protein?, carbs?, fat? }] }] }] }
-- Comidas/opciones/alimentos se reemplazan enteros (nada los referencia).
create or replace function public.save_full_plan(p_plan_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid := p_plan_id;
  v_client  uuid := nullif(p_data->>'client_id', '')::uuid;
  v_meal    jsonb;
  v_meal_id uuid;
  v_opt     jsonb;
  v_opt_id  uuid;
  v_item    jsonb;
  v_mpos    int := 0;
  v_opos    int;
  v_ipos    int;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if coalesce(trim(p_data->>'name'), '') = '' then
    raise exception 'El plan necesita un nombre.';
  end if;

  if v_id is null then
    -- Por ahora solo los coaches arman planes.
    if not exists (select 1 from public.profiles where id = v_uid and is_coach) then
      raise exception 'Solo los coaches pueden armar planes de nutrición.';
    end if;
    if v_client is not null and not exists (
      select 1 from public.coach_students where id = v_client and coach_id = v_uid
    ) then
      raise exception 'Ese cliente no es tuyo.';
    end if;
    insert into public.nutrition_plans (owner_id, client_id, name)
      values (v_uid, v_client, trim(p_data->>'name'))
      returning id into v_id;
  elsif not public.is_plan_owner(v_id) then
    raise exception 'No autorizado';
  end if;

  update public.nutrition_plans
     set name = trim(p_data->>'name'),
         folder_id = nullif(p_data->>'folder_id', '')::uuid,
         guidelines = nullif(trim(p_data->>'guidelines'), ''),
         target_kcal = nullif(p_data->>'target_kcal', '')::numeric,
         target_protein = nullif(p_data->>'target_protein', '')::numeric,
         target_carbs = nullif(p_data->>'target_carbs', '')::numeric,
         target_fat = nullif(p_data->>'target_fat', '')::numeric,
         target_water_l = nullif(p_data->>'target_water_l', '')::numeric,
         updated_at = now()
   where id = v_id;

  delete from public.nutrition_meals where plan_id = v_id;

  for v_meal in select * from jsonb_array_elements(coalesce(p_data->'meals', '[]'::jsonb)) loop
    insert into public.nutrition_meals (plan_id, name, time_label, position)
      values (v_id, coalesce(trim(v_meal->>'name'), ''), nullif(trim(v_meal->>'time_label'), ''), v_mpos)
      returning id into v_meal_id;
    v_mpos := v_mpos + 1;

    v_opos := 0;
    for v_opt in select * from jsonb_array_elements(coalesce(v_meal->'options', '[]'::jsonb)) loop
      insert into public.nutrition_options (meal_id, position)
        values (v_meal_id, v_opos)
        returning id into v_opt_id;
      v_opos := v_opos + 1;

      v_ipos := 0;
      for v_item in select * from jsonb_array_elements(coalesce(v_opt->'items', '[]'::jsonb)) loop
        insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position)
          values (
            v_opt_id,
            coalesce(trim(v_item->>'food'), ''),
            nullif(trim(v_item->>'amount'), ''),
            nullif(trim(v_item->>'unit'), ''),
            nullif(v_item->>'kcal', '')::numeric,
            nullif(v_item->>'protein', '')::numeric,
            nullif(v_item->>'carbs', '')::numeric,
            nullif(v_item->>'fat', '')::numeric,
            v_ipos
          );
        v_ipos := v_ipos + 1;
      end loop;
    end loop;
  end loop;

  return v_id;
end; $$;

-- Copias ------------------------------------------------------------------------------
create or replace function public._copy_plan(
  p_src       uuid,
  p_name      text,
  p_folder_id uuid,
  p_client_id uuid,
  p_owner     uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_src    public.nutrition_plans;
  v_new    uuid;
  v_meal   record;
  v_meal_n uuid;
  v_opt    record;
  v_opt_n  uuid;
begin
  select * into v_src from public.nutrition_plans where id = p_src;
  if v_src.id is null then
    raise exception 'No se encontró el plan.';
  end if;

  insert into public.nutrition_plans (
    owner_id, folder_id, client_id, name, guidelines,
    target_kcal, target_protein, target_carbs, target_fat, target_water_l
  ) values (
    coalesce(p_owner, v_src.owner_id), p_folder_id, p_client_id, coalesce(p_name, v_src.name),
    v_src.guidelines, v_src.target_kcal, v_src.target_protein, v_src.target_carbs,
    v_src.target_fat, v_src.target_water_l
  ) returning id into v_new;

  for v_meal in select * from public.nutrition_meals where plan_id = p_src order by position loop
    insert into public.nutrition_meals (plan_id, name, time_label, position)
      values (v_new, v_meal.name, v_meal.time_label, v_meal.position)
      returning id into v_meal_n;
    for v_opt in select * from public.nutrition_options where meal_id = v_meal.id order by position loop
      insert into public.nutrition_options (meal_id, position)
        values (v_meal_n, v_opt.position)
        returning id into v_opt_n;
      insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position)
        select v_opt_n, food, amount, unit, kcal, protein, carbs, fat, position
          from public.nutrition_items where option_id = v_opt.id;
    end loop;
  end loop;

  return v_new;
end; $$;

revoke all on function public._copy_plan(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;

-- Copiar un plan propio: a un cliente (p_client_id) o como plantilla nueva.
create or replace function public.copy_nutrition_plan(p_plan_id uuid, p_client_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_src public.nutrition_plans;
begin
  select * into v_src from public.nutrition_plans where id = p_plan_id and owner_id = auth.uid();
  if v_src.id is null then
    raise exception 'No sos dueño de este plan.';
  end if;
  if p_client_id is null then
    return public._copy_plan(p_plan_id, v_src.name || ' (copia)', v_src.folder_id, null);
  end if;
  if not exists (
    select 1 from public.coach_students where id = p_client_id and coach_id = auth.uid()
  ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;
  return public._copy_plan(p_plan_id, v_src.name, null, p_client_id);
end; $$;

-- Marcar el plan vigente del cliente (desmarca los demás de esa ficha).
create or replace function public.set_current_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.nutrition_plans
   where id = p_plan_id and owner_id = auth.uid();
  if v_client is null then
    raise exception 'Solo se marca como vigente un plan de cliente.';
  end if;
  update public.nutrition_plans
     set is_current = (id = p_plan_id), updated_at = now()
   where client_id = v_client;
end; $$;

-- Al cortar el acceso a la app, el alumno también se queda con sus planes ---------
create or replace function public._hand_over_plans(p_client uuid, p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p record;
begin
  if p_student is null then return; end if;
  for v_p in select id from public.nutrition_plans where client_id = p_client loop
    perform public._copy_plan(v_p.id, null, null, null, p_student);
  end loop;
end; $$;

revoke all on function public._hand_over_plans(uuid, uuid) from public, anon, authenticated;

create or replace function public._end_access(p_client uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_c public.coach_students;
begin
  select * into v_c from public.coach_students where id = p_client;
  if v_c.status = 'active' then
    perform public._hand_over_routines(v_c.id, v_c.student_id);
    perform public._hand_over_plans(v_c.id, v_c.student_id);
  end if;
  update public.coach_students
     set status = 'none', student_id = null, accepted_at = null, updated_at = now()
   where id = p_client;
end; $$;

revoke all on function public._end_access(uuid) from public, anon, authenticated;
