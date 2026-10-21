-- ============================================================================
-- Brabus Fit — Clientes (CRM del coach)
-- ============================================================================
-- - coach_students pasa a ser la FICHA del cliente: la crea el coach (mínimo el
--   nombre), con datos personales, físicos iniciales y notas privadas. Existe
--   aunque la persona nunca use la app.
-- - Acceso a la app (opcional) en la misma fila: status 'none' (sin app) |
--   'pending' (invitado) | 'active' (con app). student_id = cuenta vinculada.
-- - Las rutinas del coach se asignan a la ficha (routines.client_id). El alumno
--   las ve solo con acceso activo.
-- - Quitar acceso (coach), desvincularse (alumno) o archivar: el alumno se queda
--   con una copia propia de sus rutinas (0011) y el coach conserva la ficha.
--   Rechazar o cancelar una invitación solo vuelve la ficha a "sin app".
-- - Las notas y datos de la ficha son privados del coach: el alumno ya no lee
--   coach_students directamente (usa get_my_coaches()).
-- ============================================================================

-- Ficha ---------------------------------------------------------------------------
alter table public.coach_students
  add column if not exists first_name        text not null default '',
  add column if not exists last_name         text not null default '',
  add column if not exists phone             text,
  add column if not exists birth_date        date,
  add column if not exists sex               text,
  add column if not exists height_cm         numeric,
  add column if not exists initial_weight_kg numeric,
  add column if not exists goal              text,
  add column if not exists level             text,
  add column if not exists injuries          text,
  add column if not exists notes             text,
  add column if not exists archived_at       timestamptz,
  add column if not exists updated_at        timestamptz not null default now();

alter table public.coach_students alter column student_email drop not null;

alter table public.coach_students drop constraint if exists coach_students_status_check;
alter table public.coach_students
  add constraint coach_students_status_check check (status in ('none', 'pending', 'active'));
alter table public.coach_students drop constraint if exists coach_students_sex_check;
alter table public.coach_students
  add constraint coach_students_sex_check check (sex is null or sex in ('femenino', 'masculino', 'otro'));
alter table public.coach_students drop constraint if exists coach_students_goal_check;
alter table public.coach_students
  add constraint coach_students_goal_check check (
    goal is null or goal in ('bajar_peso', 'ganar_masa', 'tonificar', 'rendimiento', 'salud', 'otro'));
alter table public.coach_students drop constraint if exists coach_students_level_check;
alter table public.coach_students
  add constraint coach_students_level_check check (
    level is null or level in ('principiante', 'intermedio', 'avanzado'));

-- Nombre y datos iniciales desde el perfil de los alumnos que ya existen.
update public.coach_students c
   set first_name = p.first_name,
       last_name = p.last_name,
       birth_date = coalesce(c.birth_date, p.birth_date),
       height_cm = coalesce(c.height_cm, p.height_cm),
       initial_weight_kg = coalesce(c.initial_weight_kg, p.weight_kg)
  from public.profiles p
 where p.id = c.student_id and c.first_name = '';

-- Solo el coach ve la ficha (tiene notas privadas).
drop policy if exists coach_students_select on public.coach_students;
create policy coach_students_select on public.coach_students for select
  using (coach_id = auth.uid());

-- Rutinas asignadas a la ficha ------------------------------------------------------
alter table public.routines
  add column if not exists client_id uuid references public.coach_students(id) on delete cascade;
create index if not exists routines_client_idx on public.routines (client_id);

drop trigger if exists routines_check_student on public.routines;
drop function if exists public.routines_check_student();

do $$
declare
  v_r      record;
  v_client uuid;
begin
  for v_r in
    select r.id, r.owner_id, r.student_id, r.student_email
      from public.routines r
     where r.student_email is not null
  loop
    select c.id into v_client from public.coach_students c
     where c.coach_id = v_r.owner_id
       and (c.student_id = v_r.student_id or lower(c.student_email) = v_r.student_email)
     limit 1;

    -- Ex alumno sin vínculo: el coach se queda con su ficha (archivada, sin app).
    if v_client is null then
      insert into public.coach_students (
        coach_id, student_id, student_email, status, first_name, last_name, archived_at
      )
      select v_r.owner_id, null, v_r.student_email, 'none',
             coalesce(p.first_name, ''), coalesce(p.last_name, ''), now()
        from (select 1) x
        left join public.profiles p on p.id = v_r.student_id
      returning id into v_client;
    end if;

    update public.routines set client_id = v_client where id = v_r.id;
  end loop;
end $$;

alter table public.routines drop column if exists student_id;
alter table public.routines drop column if exists student_email;

-- La ficha tiene que ser del dueño; las rutinas de clientes no van en carpetas.
create or replace function public.routines_check_client()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is null then return new; end if;
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

drop trigger if exists routines_check_client on public.routines;
create trigger routines_check_client
  before insert or update of client_id, folder_id on public.routines
  for each row execute function public.routines_check_client();

-- Acceso -----------------------------------------------------------------------------
create or replace function public.has_routine_access(p_routine_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id
      and (
        r.owner_id = auth.uid()
        or exists (
          select 1 from public.coach_students c
           where c.id = r.client_id and c.student_id = auth.uid() and c.status = 'active'
        )
      )
  );
$$;

-- El alumno ve el perfil de sus coaches (invitación o activo) y el del dueño de
-- rutinas que entrenó (para el historial).
create or replace function public.shared_a_routine_with_me(p_profile_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = p_profile_id and student_id = auth.uid()
  ) or exists (
    select 1 from public.workout_sessions s
    join public.routines r on r.id = s.routine_id
    where s.user_id = auth.uid() and r.owner_id = p_profile_id
  );
$$;

-- Copias de rutinas (ahora por ficha) ------------------------------------------------
drop function if exists public._copy_routine(uuid, text, uuid, uuid, text, uuid);
create or replace function public._copy_routine(
  p_src       uuid,
  p_name      text,
  p_folder_id uuid,
  p_client_id uuid,
  p_owner     uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_src     public.routines;
  v_owner   uuid;
  v_new     uuid;
  v_day     record;
  v_new_day uuid;
  v_ex      record;
  v_cat     uuid;
  v_new_ex  uuid;
  v_days    jsonb := '{}'::jsonb;
  v_exs     jsonb := '{}'::jsonb;
begin
  select * into v_src from public.routines where id = p_src;
  if v_src.id is null then
    raise exception 'No se encontró la rutina.';
  end if;
  v_owner := coalesce(p_owner, v_src.owner_id);

  insert into public.routines (owner_id, folder_id, name, client_id)
    values (v_owner, p_folder_id, coalesce(p_name, v_src.name), p_client_id)
    returning id into v_new;

  for v_day in
    select * from public.routine_days where routine_id = p_src order by position, created_at
  loop
    insert into public.routine_days (routine_id, name, position)
      values (v_new, v_day.name, v_day.position)
      returning id into v_new_day;
    v_days := v_days || jsonb_build_object(v_day.id::text, v_new_day);

    for v_ex in
      select e.*, c.owner_id as cat_owner, c.name as cat_name, c.muscle_group as cat_group
        from public.exercises e
        join public.exercise_catalog c on c.id = e.catalog_id
       where e.day_id = v_day.id
       order by e.position, e.created_at
    loop
      v_cat := v_ex.catalog_id;
      -- Ejercicio propio de otro dueño: se usa (o crea) el equivalente del nuevo dueño.
      if v_ex.cat_owner is not null and v_ex.cat_owner <> v_owner then
        select id into v_cat from public.exercise_catalog
         where owner_id = v_owner and name_key = public.exercise_key(v_ex.cat_name);
        if v_cat is null then
          insert into public.exercise_catalog (name, muscle_group, owner_id)
            values (v_ex.cat_name, v_ex.cat_group, v_owner)
            returning id into v_cat;
        end if;
      end if;

      insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, position)
        values (v_new_day, v_cat, v_ex.variant, v_ex.name, v_ex.sets_reps, v_ex.position)
        returning id into v_new_ex;
      v_exs := v_exs || jsonb_build_object(v_ex.id::text, v_new_ex);
    end loop;
  end loop;

  return jsonb_build_object('id', v_new, 'days', v_days, 'exercises', v_exs);
end; $$;

revoke all on function public._copy_routine(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;

-- Al cortar el acceso: copia propia para el alumno + sus entrenamientos.
drop function if exists public._hand_over_routines(uuid, uuid);
create or replace function public._hand_over_routines(p_client uuid, p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_r   record;
  v_map jsonb;
  v_new uuid;
begin
  if p_student is null then return; end if;

  for v_r in select id from public.routines where client_id = p_client loop
    v_map := public._copy_routine(v_r.id, null, null, null, p_student);
    v_new := (v_map->>'id')::uuid;

    update public.workout_sessions
       set routine_id = v_new,
           day_id = (v_map->'days'->>day_id::text)::uuid
     where routine_id = v_r.id
       and user_id = p_student
       and v_map->'days' ? day_id::text;

    update public.exercise_logs l
       set exercise_id = (v_map->'exercises'->>l.exercise_id::text)::uuid
      from public.workout_sessions ws
     where ws.id = l.session_id
       and ws.routine_id = v_new
       and v_map->'exercises' ? l.exercise_id::text;
  end loop;
end; $$;

revoke all on function public._hand_over_routines(uuid, uuid) from public, anon, authenticated;

-- Corta el acceso a la app (deja la ficha "sin app"). Uso interno.
create or replace function public._end_access(p_client uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_c public.coach_students;
begin
  select * into v_c from public.coach_students where id = p_client;
  if v_c.status = 'active' then
    perform public._hand_over_routines(v_c.id, v_c.student_id);
  end if;
  update public.coach_students
     set status = 'none', student_id = null, accepted_at = null, updated_at = now()
   where id = p_client;
end; $$;

revoke all on function public._end_access(uuid) from public, anon, authenticated;

create or replace function public.create_full_routine(
  p_name      text,
  p_folder_id uuid,
  p_days      jsonb,
  p_link_id   uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_routine_id uuid;
  v_day        jsonb;
  v_day_id     uuid;
  v_ex         jsonb;
  v_day_pos    int := 0;
  v_ex_pos     int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_link_id is not null and not exists (
    select 1 from public.coach_students where id = p_link_id and coach_id = auth.uid()
  ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;

  insert into public.routines (owner_id, folder_id, name, client_id)
    values (
      auth.uid(),
      case when p_link_id is null then p_folder_id end,
      coalesce(p_name, ''),
      p_link_id
    )
    returning id into v_routine_id;

  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb))
  loop
    insert into public.routine_days (routine_id, name, position)
      values (v_routine_id, coalesce(v_day->>'name', ''), v_day_pos)
      returning id into v_day_id;
    v_day_pos := v_day_pos + 1;

    v_ex_pos := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb))
    loop
      insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, position)
        values (
          v_day_id,
          nullif(v_ex->>'catalog_id', '')::uuid,
          v_ex->>'variant',
          coalesce(v_ex->>'name', ''),
          coalesce(v_ex->>'sets_reps', ''),
          v_ex_pos
        );
      v_ex_pos := v_ex_pos + 1;
    end loop;
  end loop;

  return v_routine_id;
end; $$;

create or replace function public.copy_routine(p_routine_id uuid, p_link_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_src public.routines;
begin
  select * into v_src from public.routines where id = p_routine_id and owner_id = auth.uid();
  if v_src.id is null then
    raise exception 'No sos dueño de esta rutina.';
  end if;

  if p_link_id is null then
    return (public._copy_routine(
      p_routine_id, v_src.name || ' (copia)', v_src.folder_id, null
    )->>'id')::uuid;
  end if;

  if not exists (
    select 1 from public.coach_students where id = p_link_id and coach_id = auth.uid()
  ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;

  return (public._copy_routine(p_routine_id, v_src.name, null, p_link_id)->>'id')::uuid;
end; $$;

-- Fichas: alta / edición -------------------------------------------------------------
-- p_data: { first_name, last_name, email, phone, birth_date, sex, height_cm,
--           initial_weight_kg, goal, level, injuries, notes }
create or replace function public.save_client(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid := p_id;
  v_email text := nullif(lower(trim(p_data->>'email')), '');
  v_c     public.coach_students;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and is_coach) then
    raise exception 'Solo los coaches pueden cargar clientes.';
  end if;
  if coalesce(trim(p_data->>'first_name'), '') = '' then
    raise exception 'El cliente necesita un nombre.';
  end if;
  if v_email is not null and position('@' in v_email) = 0 then
    raise exception 'Revisá el email.';
  end if;
  if v_email is not null and exists (
    select 1 from public.coach_students
     where coach_id = v_uid and lower(student_email) = v_email and id is distinct from p_id
  ) then
    raise exception 'Ya tenés un cliente con ese email.';
  end if;

  if v_id is null then
    insert into public.coach_students (coach_id, status, first_name)
      values (v_uid, 'none', trim(p_data->>'first_name'))
      returning id into v_id;
  else
    select * into v_c from public.coach_students where id = v_id and coach_id = v_uid;
    if v_c.id is null then
      raise exception 'Ese cliente no es tuyo.';
    end if;
  end if;

  update public.coach_students
     set first_name = trim(p_data->>'first_name'),
         last_name = coalesce(trim(p_data->>'last_name'), ''),
         -- Con la app vinculada (o invitado) el email es el de su cuenta.
         student_email = case when status = 'none' then v_email else student_email end,
         phone = nullif(trim(p_data->>'phone'), ''),
         birth_date = nullif(p_data->>'birth_date', '')::date,
         sex = nullif(p_data->>'sex', ''),
         height_cm = nullif(p_data->>'height_cm', '')::numeric,
         initial_weight_kg = nullif(p_data->>'initial_weight_kg', '')::numeric,
         goal = nullif(p_data->>'goal', ''),
         level = nullif(p_data->>'level', ''),
         injuries = nullif(trim(p_data->>'injuries'), ''),
         notes = nullif(trim(p_data->>'notes'), ''),
         updated_at = now()
   where id = v_id;

  return v_id;
end; $$;

-- Invitar una ficha a la app -----------------------------------------------------------
-- Estados: forbidden | invalid | not_found | self | coach | already | existing | new
create or replace function public.validate_invite_client(p_client_id uuid, p_mode text, p_value text)
returns text
language plpgsql security definer set search_path = public stable as $$
declare
  v_uid    uuid := auth.uid();
  v_value  text := lower(trim(p_value));
  v_target uuid;
  v_email  text;
begin
  if v_uid is null or not exists (
    select 1 from public.coach_students where id = p_client_id and coach_id = v_uid
  ) then
    return 'forbidden';
  end if;
  if v_value = '' then return 'invalid'; end if;

  if p_mode = 'username' then
    select p.id, lower(u.email) into v_target, v_email
      from public.profiles p join auth.users u on u.id = p.id
     where lower(p.username) = v_value;
    if v_target is null then return 'not_found'; end if;
  else
    if position('@' in v_value) = 0 then return 'invalid'; end if;
    v_email := v_value;
    select id into v_target from auth.users where lower(email) = v_email limit 1;
  end if;

  if v_target = v_uid or v_email = (select lower(email) from auth.users where id = v_uid) then
    return 'self';
  end if;
  if v_target is not null and exists (select 1 from public.profiles where id = v_target and is_coach) then
    return 'coach';
  end if;
  if exists (
    select 1 from public.coach_students
     where coach_id = v_uid and id <> p_client_id
       and (student_id = v_target or lower(student_email) = v_email)
  ) then
    return 'already';
  end if;
  return case when v_target is not null then 'existing' else 'new' end;
end; $$;

create or replace function public.invite_client(p_client_id uuid, p_mode text, p_value text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status text := public.validate_invite_client(p_client_id, p_mode, p_value);
  v_value  text := lower(trim(p_value));
  v_target uuid;
  v_email  text;
begin
  case v_status
    when 'forbidden' then raise exception 'Ese cliente no es tuyo.';
    when 'invalid'   then raise exception 'Revisá el email o usuario.';
    when 'not_found' then raise exception 'No existe un usuario con ese nombre.';
    when 'self'      then raise exception 'No podés invitarte a vos mismo.';
    when 'coach'     then raise exception 'No podés invitar a un coach como cliente.';
    when 'already'   then raise exception 'Otro de tus clientes ya usa esa cuenta o email.';
    else null;
  end case;

  if p_mode = 'username' then
    select p.id, lower(u.email) into v_target, v_email
      from public.profiles p join auth.users u on u.id = p.id
     where lower(p.username) = v_value;
  else
    v_email := v_value;
    select id into v_target from auth.users where lower(email) = v_email limit 1;
  end if;

  update public.coach_students
     set student_id = v_target,
         student_email = v_email,
         status = 'pending',
         archived_at = null,
         created_at = now(),
         updated_at = now()
   where id = p_client_id and status = 'none';
  if not found then
    raise exception 'Este cliente ya tiene la app o una invitación pendiente.';
  end if;

  return jsonb_build_object('existed', v_target is not null, 'email', v_email);
end; $$;

-- Quitar acceso a la app (coach): el alumno se queda con su copia de las rutinas.
create or replace function public.remove_client_access(p_client_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.coach_students where id = p_client_id and coach_id = auth.uid()
  ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;
  perform public._end_access(p_client_id);
end; $$;

-- Archivar / reactivar (archivar también corta el acceso a la app).
create or replace function public.set_client_archived(p_client_id uuid, p_archived boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.coach_students where id = p_client_id and coach_id = auth.uid()
  ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;
  if p_archived then
    perform public._end_access(p_client_id);
  end if;
  update public.coach_students
     set archived_at = case when p_archived then now() end, updated_at = now()
   where id = p_client_id;
end; $$;

-- Eliminar la ficha (y sus rutinas). Si tenía la app, antes se lleva su copia.
create or replace function public.delete_client(p_client_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.coach_students where id = p_client_id and coach_id = auth.uid()
  ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;
  perform public._end_access(p_client_id);
  delete from public.coach_students where id = p_client_id;
end; $$;

-- Compatibilidad con la app anterior: "desvincular" = quitar acceso.
create or replace function public.unlink_student(p_link_id uuid, p_keep_routines boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.remove_client_access(p_link_id);
end; $$;

-- Alumno: sus coaches e invitaciones ------------------------------------------------
create or replace function public.get_my_coaches()
returns table (link_id uuid, coach_id uuid, status text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select id, coach_id, status, created_at
    from public.coach_students
   where student_id = auth.uid() and status in ('pending', 'active')
   order by created_at desc;
$$;

create or replace function public.respond_invitation(p_link_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.profiles;
begin
  if not exists (
    select 1 from public.coach_students
     where id = p_link_id and student_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'La invitación ya no existe.';
  end if;

  if p_accept then
    select * into v_p from public.profiles where id = auth.uid();
    -- Completa lo que la ficha no tenga con el perfil del alumno.
    update public.coach_students
       set status = 'active',
           accepted_at = now(),
           first_name = case when first_name = '' then v_p.first_name else first_name end,
           last_name = case when last_name = '' then v_p.last_name else last_name end,
           birth_date = coalesce(birth_date, v_p.birth_date),
           height_cm = coalesce(height_cm, v_p.height_cm),
           initial_weight_kg = coalesce(initial_weight_kg, v_p.weight_kg),
           updated_at = now()
     where id = p_link_id;
  else
    update public.coach_students
       set status = 'none', student_id = null, updated_at = now()
     where id = p_link_id;
  end if;
end; $$;

-- Alumno se desvincula: igual que si el coach le quita el acceso.
create or replace function public.leave_coach(p_link_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.coach_students
     where id = p_link_id and student_id = auth.uid() and status in ('pending', 'active')
  ) then
    raise exception 'Ese coach no está vinculado a vos.';
  end if;
  perform public._end_access(p_link_id);
end; $$;

-- Alta de usuario: toma las invitaciones pendientes a su email ------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_coach boolean := coalesce((new.raw_user_meta_data->>'is_coach')::boolean, false);
begin
  insert into public.profiles (
    id, first_name, last_name, birth_date, height_cm, weight_kg, is_coach, onboarded, username
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'first_name',
      new.raw_user_meta_data->>'given_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      ''
    ),
    coalesce(
      new.raw_user_meta_data->>'last_name',
      new.raw_user_meta_data->>'family_name',
      ''
    ),
    nullif(new.raw_user_meta_data->>'birth_date', '')::date,
    nullif(new.raw_user_meta_data->>'height_cm', '')::numeric,
    nullif(new.raw_user_meta_data->>'weight_kg', '')::numeric,
    v_is_coach,
    (new.raw_user_meta_data ? 'is_coach'),
    nullif(lower(trim(new.raw_user_meta_data->>'username')), '')
  )
  on conflict (id) do nothing;

  if not v_is_coach then
    update public.coach_students
       set student_id = new.id
     where lower(student_email) = lower(new.email)
       and student_id is null
       and status = 'pending';
  end if;

  return new;
end; $$;
