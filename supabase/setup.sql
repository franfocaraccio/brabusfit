-- Brabus Fit - Setup completo (0001..0008). Pegar entero en el SQL Editor de Supabase.


-- ============================ 0001_init.sql ============================

-- ============================================================================
-- Brabus Fit â€” Esquema inicial
-- Ejecutar en el SQL Editor de Supabase (o vÃ­a `supabase db push`).
-- Idempotente en lo posible.
-- ============================================================================

-- Extensiones -----------------------------------------------------------------
create extension if not exists pgcrypto;

-- Enums -----------------------------------------------------------------------
do $$ begin
  create type public.share_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_status as enum ('in_progress', 'finished', 'abandoned');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- TABLAS
-- ============================================================================

-- profiles (1:1 con auth.users) ----------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  birth_date  date,
  height_cm   numeric,
  weight_kg   numeric,
  is_coach    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- folders ---------------------------------------------------------------------
create table if not exists public.folders (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  parent_folder_id uuid references public.folders(id) on delete cascade,
  created_at       timestamptz not null default now()
);
create index if not exists folders_owner_idx on public.folders(owner_id);

-- routines --------------------------------------------------------------------
create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  folder_id  uuid references public.folders(id) on delete set null,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routines_owner_idx on public.routines(owner_id);
create index if not exists routines_folder_idx on public.routines(folder_id);

-- routine_days ----------------------------------------------------------------
create table if not exists public.routine_days (
  id         uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists routine_days_routine_idx on public.routine_days(routine_id);

-- exercises -------------------------------------------------------------------
create table if not exists public.exercises (
  id         uuid primary key default gen_random_uuid(),
  day_id     uuid not null references public.routine_days(id) on delete cascade,
  name       text not null,
  sets_reps  text not null default '',
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists exercises_day_idx on public.exercises(day_id);

-- routine_shares --------------------------------------------------------------
create table if not exists public.routine_shares (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid not null references public.routines(id) on delete cascade,
  shared_by           uuid not null references public.profiles(id) on delete cascade,
  shared_with_email   text not null,
  shared_with_user_id uuid references public.profiles(id) on delete cascade,
  status              public.share_status not null default 'pending',
  created_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  unique (routine_id, shared_with_email)
);
create index if not exists shares_routine_idx on public.routine_shares(routine_id);
create index if not exists shares_email_idx on public.routine_shares(lower(shared_with_email));
create index if not exists shares_user_idx on public.routine_shares(shared_with_user_id);

-- workout_sessions ------------------------------------------------------------
create table if not exists public.workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  routine_id  uuid not null references public.routines(id) on delete cascade,
  day_id      uuid not null references public.routine_days(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      public.session_status not null default 'in_progress'
);
create index if not exists sessions_user_idx on public.workout_sessions(user_id);
create index if not exists sessions_routine_idx on public.workout_sessions(routine_id);
create index if not exists sessions_day_idx on public.workout_sessions(day_id);

-- exercise_logs ---------------------------------------------------------------
create table if not exists public.exercise_logs (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  completed   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (session_id, exercise_id)
);
create index if not exists exercise_logs_session_idx on public.exercise_logs(session_id);
create index if not exists exercise_logs_exercise_idx on public.exercise_logs(exercise_id);

-- set_logs --------------------------------------------------------------------
create table if not exists public.set_logs (
  id              uuid primary key default gen_random_uuid(),
  exercise_log_id uuid not null references public.exercise_logs(id) on delete cascade,
  set_number      int not null,
  weight          numeric,
  reps            int
);
create index if not exists set_logs_exercise_log_idx on public.set_logs(exercise_log_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- updated_at automÃ¡tico -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists routines_updated_at on public.routines;
create trigger routines_updated_at before update on public.routines
  for each row execute function public.set_updated_at();

-- Crear profile al registrarse + bindear shares pendientes --------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, birth_date, height_cm, weight_kg, is_coach)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'first_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      ''
    ),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'birth_date', '')::date,
    nullif(new.raw_user_meta_data->>'height_cm', '')::numeric,
    nullif(new.raw_user_meta_data->>'weight_kg', '')::numeric,
    coalesce((new.raw_user_meta_data->>'is_coach')::boolean, false)
  )
  on conflict (id) do nothing;

  -- Vincula rutinas que ya le habÃ­an compartido por email (estado pendiente).
  update public.routine_shares
     set shared_with_user_id = new.id,
         status = 'accepted',
         accepted_at = now()
   where lower(shared_with_email) = lower(new.email)
     and shared_with_user_id is null;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- HELPERS DE ACCESO (SECURITY DEFINER para evitar recursiÃ³n de RLS)
-- ============================================================================

create or replace function public.is_routine_owner(p_routine_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.routines
    where id = p_routine_id and owner_id = auth.uid()
  );
$$;

create or replace function public.has_routine_access(p_routine_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.routines
    where id = p_routine_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.routine_shares
    where routine_id = p_routine_id
      and shared_with_user_id = auth.uid()
      and status = 'accepted'
  );
$$;

create or replace function public.has_day_access(p_day_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.has_routine_access(routine_id)
  from public.routine_days where id = p_day_id;
$$;

create or replace function public.is_day_owner(p_day_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_routine_owner(routine_id)
  from public.routine_days where id = p_day_id;
$$;

create or replace function public.is_exercise_owner(p_exercise_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_day_owner(day_id)
  from public.exercises where id = p_exercise_id;
$$;

create or replace function public.has_exercise_access(p_exercise_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.has_day_access(day_id)
  from public.exercises where id = p_exercise_id;
$$;

create or replace function public.owns_session(p_session_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.workout_sessions
    where id = p_session_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_view_session(p_session_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.workout_sessions s
    where s.id = p_session_id
      and (s.user_id = auth.uid() or public.is_routine_owner(s.routine_id))
  );
$$;

create or replace function public.owns_exercise_log(p_log_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.owns_session(session_id)
  from public.exercise_logs where id = p_log_id;
$$;

create or replace function public.can_view_exercise_log(p_log_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.can_view_session(session_id)
  from public.exercise_logs where id = p_log_id;
$$;

create or replace function public.is_my_student(p_profile_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.routine_shares
    where shared_by = auth.uid()
      and shared_with_user_id = p_profile_id
  );
$$;

-- Â¿Ese perfil (un coach) me compartiÃ³ alguna rutina a mÃ­?
create or replace function public.shared_a_routine_with_me(p_profile_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.routine_shares
    where shared_by = p_profile_id
      and shared_with_user_id = auth.uid()
  );
$$;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.profiles         enable row level security;
alter table public.folders          enable row level security;
alter table public.routines         enable row level security;
alter table public.routine_days     enable row level security;
alter table public.exercises        enable row level security;
alter table public.routine_shares   enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs    enable row level security;
alter table public.set_logs         enable row level security;

-- profiles --------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or public.is_my_student(id)
    or public.shared_a_routine_with_me(id)
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- folders ---------------------------------------------------------------------
drop policy if exists folders_all on public.folders;
create policy folders_all on public.folders for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- routines --------------------------------------------------------------------
drop policy if exists routines_select on public.routines;
create policy routines_select on public.routines for select
  using (public.has_routine_access(id));

drop policy if exists routines_insert on public.routines;
create policy routines_insert on public.routines for insert
  with check (owner_id = auth.uid());

drop policy if exists routines_update on public.routines;
create policy routines_update on public.routines for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists routines_delete on public.routines;
create policy routines_delete on public.routines for delete
  using (owner_id = auth.uid());

-- routine_days ----------------------------------------------------------------
drop policy if exists routine_days_select on public.routine_days;
create policy routine_days_select on public.routine_days for select
  using (public.has_routine_access(routine_id));

drop policy if exists routine_days_insert on public.routine_days;
create policy routine_days_insert on public.routine_days for insert
  with check (public.is_routine_owner(routine_id));

drop policy if exists routine_days_update on public.routine_days;
create policy routine_days_update on public.routine_days for update
  using (public.is_routine_owner(routine_id))
  with check (public.is_routine_owner(routine_id));

drop policy if exists routine_days_delete on public.routine_days;
create policy routine_days_delete on public.routine_days for delete
  using (public.is_routine_owner(routine_id));

-- exercises -------------------------------------------------------------------
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select
  using (public.has_day_access(day_id));

drop policy if exists exercises_insert on public.exercises;
create policy exercises_insert on public.exercises for insert
  with check (public.is_day_owner(day_id));

drop policy if exists exercises_update on public.exercises;
create policy exercises_update on public.exercises for update
  using (public.is_day_owner(day_id))
  with check (public.is_day_owner(day_id));

drop policy if exists exercises_delete on public.exercises;
create policy exercises_delete on public.exercises for delete
  using (public.is_day_owner(day_id));

-- routine_shares --------------------------------------------------------------
drop policy if exists shares_select on public.routine_shares;
create policy shares_select on public.routine_shares for select
  using (shared_by = auth.uid() or shared_with_user_id = auth.uid());

drop policy if exists shares_insert on public.routine_shares;
create policy shares_insert on public.routine_shares for insert
  with check (shared_by = auth.uid() and public.is_routine_owner(routine_id));

drop policy if exists shares_update on public.routine_shares;
create policy shares_update on public.routine_shares for update
  using (shared_by = auth.uid()) with check (shared_by = auth.uid());

drop policy if exists shares_delete on public.routine_shares;
create policy shares_delete on public.routine_shares for delete
  using (shared_by = auth.uid());

-- workout_sessions ------------------------------------------------------------
drop policy if exists sessions_select on public.workout_sessions;
create policy sessions_select on public.workout_sessions for select
  using (user_id = auth.uid() or public.is_routine_owner(routine_id));

drop policy if exists sessions_insert on public.workout_sessions;
create policy sessions_insert on public.workout_sessions for insert
  with check (user_id = auth.uid() and public.has_routine_access(routine_id));

drop policy if exists sessions_update on public.workout_sessions;
create policy sessions_update on public.workout_sessions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sessions_delete on public.workout_sessions;
create policy sessions_delete on public.workout_sessions for delete
  using (user_id = auth.uid());

-- exercise_logs ---------------------------------------------------------------
drop policy if exists exercise_logs_select on public.exercise_logs;
create policy exercise_logs_select on public.exercise_logs for select
  using (public.can_view_session(session_id));

drop policy if exists exercise_logs_insert on public.exercise_logs;
create policy exercise_logs_insert on public.exercise_logs for insert
  with check (public.owns_session(session_id));

drop policy if exists exercise_logs_update on public.exercise_logs;
create policy exercise_logs_update on public.exercise_logs for update
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

drop policy if exists exercise_logs_delete on public.exercise_logs;
create policy exercise_logs_delete on public.exercise_logs for delete
  using (public.owns_session(session_id));

-- set_logs --------------------------------------------------------------------
drop policy if exists set_logs_select on public.set_logs;
create policy set_logs_select on public.set_logs for select
  using (public.can_view_exercise_log(exercise_log_id));

drop policy if exists set_logs_insert on public.set_logs;
create policy set_logs_insert on public.set_logs for insert
  with check (public.owns_exercise_log(exercise_log_id));

drop policy if exists set_logs_update on public.set_logs;
create policy set_logs_update on public.set_logs for update
  using (public.owns_exercise_log(exercise_log_id))
  with check (public.owns_exercise_log(exercise_log_id));

drop policy if exists set_logs_delete on public.set_logs;
create policy set_logs_delete on public.set_logs for delete
  using (public.owns_exercise_log(exercise_log_id));


-- ============================ 0002_functions.sql ============================

-- ============================================================================
-- Brabus Fit â€” Funciones RPC para crear/editar rutinas completas (atÃ³mico)
-- ============================================================================

-- Crear rutina con sus dÃ­as y ejercicios en una sola transacciÃ³n ---------------
-- p_days: [{ "name": text, "exercises": [{ "name": text, "sets_reps": text }] }]
create or replace function public.create_full_routine(
  p_name      text,
  p_folder_id uuid,
  p_days      jsonb
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

  insert into public.routines (owner_id, folder_id, name)
    values (auth.uid(), p_folder_id, coalesce(p_name, ''))
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
      insert into public.exercises (day_id, name, sets_reps, position)
        values (
          v_day_id,
          coalesce(v_ex->>'name', ''),
          coalesce(v_ex->>'sets_reps', ''),
          v_ex_pos
        );
      v_ex_pos := v_ex_pos + 1;
    end loop;
  end loop;

  return v_routine_id;
end; $$;

-- Editar rutina completa con diff por id (preserva ids no modificados, asÃ­ no
-- se borran los registros de entrenamiento de ejercicios que siguen existiendo).
-- p_days: [{ "id"?: uuid, "name": text, "exercises": [{ "id"?: uuid, "name": text, "sets_reps": text }] }]
create or replace function public.update_full_routine(
  p_routine_id uuid,
  p_name       text,
  p_folder_id  uuid,
  p_days       jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_day     jsonb;
  v_day_id  uuid;
  v_ex      jsonb;
  v_day_pos int := 0;
  v_ex_pos  int;
begin
  if not public.is_routine_owner(p_routine_id) then
    raise exception 'No autorizado';
  end if;

  update public.routines
     set name = coalesce(p_name, name),
         folder_id = p_folder_id,
         updated_at = now()
   where id = p_routine_id;

  -- Borra los dÃ­as que ya no estÃ¡n en el payload.
  delete from public.routine_days
   where routine_id = p_routine_id
     and id not in (
       select (d->>'id')::uuid
       from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) d
       where d->>'id' is not null
     );

  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb))
  loop
    if v_day->>'id' is not null then
      v_day_id := (v_day->>'id')::uuid;
      update public.routine_days
         set name = coalesce(v_day->>'name', ''), position = v_day_pos
       where id = v_day_id and routine_id = p_routine_id;
    else
      insert into public.routine_days (routine_id, name, position)
        values (p_routine_id, coalesce(v_day->>'name', ''), v_day_pos)
        returning id into v_day_id;
    end if;
    v_day_pos := v_day_pos + 1;

    -- Borra los ejercicios de este dÃ­a que ya no estÃ¡n.
    delete from public.exercises
     where day_id = v_day_id
       and id not in (
         select (e->>'id')::uuid
         from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb)) e
         where e->>'id' is not null
       );

    v_ex_pos := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb))
    loop
      if v_ex->>'id' is not null then
        update public.exercises
           set name = coalesce(v_ex->>'name', ''),
               sets_reps = coalesce(v_ex->>'sets_reps', ''),
               position = v_ex_pos
         where id = (v_ex->>'id')::uuid and day_id = v_day_id;
      else
        insert into public.exercises (day_id, name, sets_reps, position)
          values (
            v_day_id,
            coalesce(v_ex->>'name', ''),
            coalesce(v_ex->>'sets_reps', ''),
            v_ex_pos
          );
      end if;
      v_ex_pos := v_ex_pos + 1;
    end loop;
  end loop;

  return p_routine_id;
end; $$;


-- ============================ 0003_share.sql ============================

-- ============================================================================
-- Brabus Fit â€” Compartir rutina por email
-- ============================================================================

-- Comparte una rutina con un email. Si ya existe un usuario con ese email, la
-- vincula al instante (status accepted); si no, la deja pendiente y el trigger
-- on_auth_user_created la vincularÃ¡ cuando esa persona cree su cuenta.
-- Devuelve { existed: boolean, email: text }.
create or replace function public.share_routine(
  p_routine_id uuid,
  p_email      text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(trim(p_email));
  v_target  uuid;
  v_existed boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.routines where id = p_routine_id and owner_id = v_uid
  ) then
    raise exception 'No sos dueÃ±o de esta rutina';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Email invÃ¡lido';
  end if;

  select id into v_target
  from auth.users
  where lower(email) = v_email
  limit 1;

  v_existed := v_target is not null;

  insert into public.routine_shares (
    routine_id, shared_by, shared_with_email, shared_with_user_id, status, accepted_at
  )
  values (
    p_routine_id, v_uid, v_email, v_target,
    case when v_existed then 'accepted'::public.share_status
         else 'pending'::public.share_status end,
    case when v_existed then now() else null end
  )
  on conflict (routine_id, shared_with_email) do update
    set shared_with_user_id = excluded.shared_with_user_id,
        status              = excluded.status,
        accepted_at         = excluded.accepted_at;

  return jsonb_build_object('existed', v_existed, 'email', v_email);
end; $$;


-- ============================ 0004_onboarding.sql ============================

-- ============================================================================
-- Brabus Fit â€” Onboarding de perfil + fix de nombre/apellido para SSO (Google)
-- ============================================================================

-- 1) Columna onboarded: marca si el usuario ya completÃ³ sus datos.
alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- 2) Backfill: los usuarios que ya tienen apellido (altas por email/contraseÃ±a)
--    se consideran completos. Los de Google (sin apellido) quedan pendientes.
update public.profiles
   set onboarded = true
 where coalesce(last_name, '') <> '';

-- 3) Trigger de alta: usa given_name/family_name de Google y marca onboarded.
--    - Alta por email/contraseÃ±a: el metadata incluye 'is_coach' => onboarded = true.
--    - Alta por Google: no incluye 'is_coach' => onboarded = false (irÃ¡ a /completar-perfil).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    id, first_name, last_name, birth_date, height_cm, weight_kg, is_coach, onboarded
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
    coalesce((new.raw_user_meta_data->>'is_coach')::boolean, false),
    (new.raw_user_meta_data ? 'is_coach')
  )
  on conflict (id) do nothing;

  update public.routine_shares
     set shared_with_user_id = new.id,
         status = 'accepted',
         accepted_at = now()
   where lower(shared_with_email) = lower(new.email)
     and shared_with_user_id is null;

  return new;
end; $$;


-- ============================ 0005_share_validations.sql ============================

-- ============================================================================
-- Brabus Fit â€” Validaciones al compartir rutinas
--   * No se puede compartir con un coach
--   * No se puede compartir con uno mismo
--   * FunciÃ³n de validaciÃ³n en vivo (mientras se escribe el email)
-- ============================================================================

-- 1) share_routine con validaciones server-side (fuente de verdad).
create or replace function public.share_routine(
  p_routine_id uuid,
  p_email      text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(trim(p_email));
  v_target  uuid;
  v_existed boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.routines where id = p_routine_id and owner_id = v_uid
  ) then
    raise exception 'No sos dueÃ±o de esta rutina';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Email invÃ¡lido';
  end if;

  -- No compartir con uno mismo.
  if v_email = (select lower(email) from auth.users where id = v_uid) then
    raise exception 'No podÃ©s compartirte una rutina a vos mismo';
  end if;

  select id into v_target
  from auth.users
  where lower(email) = v_email
  limit 1;

  v_existed := v_target is not null;

  -- No compartir con un coach.
  if v_existed and exists (
    select 1 from public.profiles where id = v_target and is_coach
  ) then
    raise exception 'No podÃ©s compartir una rutina con un coach';
  end if;

  insert into public.routine_shares (
    routine_id, shared_by, shared_with_email, shared_with_user_id, status, accepted_at
  )
  values (
    p_routine_id, v_uid, v_email, v_target,
    case when v_existed then 'accepted'::public.share_status
         else 'pending'::public.share_status end,
    case when v_existed then now() else null end
  )
  on conflict (routine_id, shared_with_email) do update
    set shared_with_user_id = excluded.shared_with_user_id,
        status              = excluded.status,
        accepted_at         = excluded.accepted_at;

  return jsonb_build_object('existed', v_existed, 'email', v_email);
end; $$;

-- 2) ValidaciÃ³n en vivo: devuelve el estado del email para el feedback del UI.
--    Estados: invalid | forbidden | self | coach | already | existing | new
create or replace function public.validate_share_email(
  p_routine_id uuid,
  p_email      text
) returns text
language plpgsql security definer set search_path = public stable as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := lower(trim(p_email));
  v_target uuid;
begin
  if v_uid is null then return 'forbidden'; end if;

  if not exists (
    select 1 from public.routines where id = p_routine_id and owner_id = v_uid
  ) then
    return 'forbidden';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return 'invalid';
  end if;

  if v_email = (select lower(email) from auth.users where id = v_uid) then
    return 'self';
  end if;

  select id into v_target
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_target is not null and exists (
    select 1 from public.profiles where id = v_target and is_coach
  ) then
    return 'coach';
  end if;

  if exists (
    select 1 from public.routine_shares
    where routine_id = p_routine_id and lower(shared_with_email) = v_email
  ) then
    return 'already';
  end if;

  if v_target is not null then return 'existing'; else return 'new'; end if;
end; $$;

-- 3) handle_new_user: que NO vincule shares pendientes si el nuevo usuario es
--    coach (los coaches no reciben rutinas compartidas).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_coach boolean := coalesce((new.raw_user_meta_data->>'is_coach')::boolean, false);
begin
  insert into public.profiles (
    id, first_name, last_name, birth_date, height_cm, weight_kg, is_coach, onboarded
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
    (new.raw_user_meta_data ? 'is_coach')
  )
  on conflict (id) do nothing;

  if not v_is_coach then
    update public.routine_shares
       set shared_with_user_id = new.id,
           status = 'accepted',
           accepted_at = now()
     where lower(shared_with_email) = lower(new.email)
       and shared_with_user_id is null;
  end if;

  return new;
end; $$;


-- ============================ 0006_username_and_notes.sql ============================

-- ============================================================================
-- Brabus Fit â€” Nombre de usuario (username) + nota por ejercicio
-- ============================================================================

-- 1) username en profiles (Ãºnico, case-insensitive). Nullable: los usuarios
--    existentes se completan a mano; los de Google en /completar-perfil.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username));

-- 2) Nota opcional por ejercicio dentro de una sesiÃ³n de entrenamiento.
alter table public.exercise_logs add column if not exists note text;

-- 3) Â¿EstÃ¡ disponible este username? (callable por anon durante el signup)
create or replace function public.username_available(p_username text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(p_username))
      and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

-- 4) ValidaciÃ³n en vivo para compartir por username.
--    Estados: forbidden | invalid | not_found | self | coach | already | existing
create or replace function public.validate_share_username(
  p_routine_id uuid,
  p_username   text
) returns text
language plpgsql security definer set search_path = public stable as $$
declare
  v_uid    uuid := auth.uid();
  v_uname  text := lower(trim(p_username));
  v_target uuid;
  v_email  text;
begin
  if v_uid is null then return 'forbidden'; end if;
  if not exists (
    select 1 from public.routines where id = p_routine_id and owner_id = v_uid
  ) then
    return 'forbidden';
  end if;
  if v_uname = '' then return 'invalid'; end if;

  select p.id, lower(u.email) into v_target, v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = v_uname;

  if v_target is null then return 'not_found'; end if;
  if v_target = v_uid then return 'self'; end if;
  if exists (select 1 from public.profiles where id = v_target and is_coach) then
    return 'coach';
  end if;
  if exists (
    select 1 from public.routine_shares
    where routine_id = p_routine_id
      and (shared_with_user_id = v_target or lower(shared_with_email) = v_email)
  ) then
    return 'already';
  end if;
  return 'existing';
end; $$;

-- 5) Compartir por username: resuelve a email y reutiliza share_routine
--    (que ya valida dueÃ±o, self y coach).
create or replace function public.share_routine_by_username(
  p_routine_id uuid,
  p_username   text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
begin
  select lower(u.email) into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_username));

  if v_email is null then
    raise exception 'No existe un usuario con ese nombre de usuario';
  end if;

  return public.share_routine(p_routine_id, v_email);
end; $$;

-- 6) handle_new_user: setea username desde el metadata (signup email/pass).
--    Google no lo manda -> queda null y se completa en /completar-perfil.
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
    update public.routine_shares
       set shared_with_user_id = new.id,
           status = 'accepted',
           accepted_at = now()
     where lower(shared_with_email) = lower(new.email)
       and shared_with_user_id is null;
  end if;

  return new;
end; $$;


-- ============================ 0007_edit_sessions.sql ============================

-- ============================================================================
-- Brabus Fit — Editar sesiones de entrenamiento ya guardadas
-- ============================================================================
-- Reemplaza de una sola vez (transacción) las series y el detalle de cada
-- ejercicio de una sesión finalizada. Solo el que entrenó puede hacerlo.
--
-- p_logs: [{ "log_id": uuid, "note": text|null,
--            "sets": [{ "weight": number|null, "reps": int|null }, ...] }, ...]
-- - Los ejercicios de la sesión que NO vienen en p_logs se eliminan.
-- - Un ejercicio que queda sin series y sin detalle se elimina.
-- ============================================================================

create or replace function public.update_session_logs(
  p_session_id uuid,
  p_logs jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_log jsonb;
  v_log_id uuid;
  v_note text;
  v_set jsonb;
  v_n int;
  v_keep uuid[] := '{}';
begin
  if not exists (
    select 1 from public.workout_sessions
    where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'No podés editar esta sesión.';
  end if;

  for v_log in select * from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb)) loop
    v_log_id := (v_log->>'log_id')::uuid;
    if not exists (
      select 1 from public.exercise_logs
      where id = v_log_id and session_id = p_session_id
    ) then
      raise exception 'El ejercicio no pertenece a la sesión.';
    end if;

    v_note := nullif(left(btrim(coalesce(v_log->>'note', '')), 80), '');

    delete from public.set_logs where exercise_log_id = v_log_id;

    v_n := 0;
    for v_set in select * from jsonb_array_elements(coalesce(v_log->'sets', '[]'::jsonb)) loop
      if (v_set->>'weight') is null and (v_set->>'reps') is null then
        continue;
      end if;
      v_n := v_n + 1;
      insert into public.set_logs (exercise_log_id, set_number, weight, reps)
      values (v_log_id, v_n, (v_set->>'weight')::numeric, (v_set->>'reps')::int);
    end loop;

    if v_n = 0 and v_note is null then
      delete from public.exercise_logs where id = v_log_id;
    else
      update public.exercise_logs set note = v_note where id = v_log_id;
      v_keep := v_keep || v_log_id;
    end if;
  end loop;

  delete from public.exercise_logs
  where session_id = p_session_id and not (id = any(v_keep));
end;
$$;

grant execute on function public.update_session_logs(uuid, jsonb) to authenticated;


-- ============================ 0008_exercise_catalog.sql ============================

-- ============================================================================
-- Brabus Fit — Catálogo de ejercicios
-- ============================================================================
-- - exercise_catalog: ejercicios generales (owner_id null) + propios de cada
--   usuario (solo los ve quien los creó).
-- - exercises (el ejercicio dentro de un día de rutina) pasa a apuntar al
--   catálogo (catalog_id) con una variante opcional ("Mancuernas / Smith").
-- - exercises.name se mantiene como etiqueta calculada ("Nombre (variante)"),
--   así todo lo que ya lee "name" sigue funcionando.
-- - Compatibilidad: si llega un ejercicio solo con nombre (app vieja), se busca
--   en el catálogo y, si no existe, se crea como ejercicio propio del dueño.
-- ============================================================================

-- Clave de comparación: sin tildes, minúsculas, espacios simples ------------
create or replace function public.exercise_key(p text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
    lower(translate(coalesce(p, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
    '\s+', ' ', 'g'))
$$;

-- Catálogo ------------------------------------------------------------------
create table if not exists public.exercise_catalog (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (btrim(name) <> ''),
  muscle_group text not null check (muscle_group in (
    'pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazos',
    'cuadriceps', 'isquiotibiales', 'gluteos', 'aductores', 'pantorrillas',
    'core', 'full_body', 'otros')),
  owner_id     uuid references public.profiles(id) on delete cascade,
  name_key     text generated always as (public.exercise_key(name)) stored,
  created_at   timestamptz not null default now()
);

-- Un nombre por dueño (y uno solo en el catálogo general).
create unique index if not exists exercise_catalog_name_unique
  on public.exercise_catalog (
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), name_key);
create index if not exists exercise_catalog_owner_idx on public.exercise_catalog (owner_id);

-- Un ejercicio propio no puede repetir uno del catálogo general.
create or replace function public.exercise_catalog_check_general()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_id is not null and exists (
    select 1 from public.exercise_catalog
    where owner_id is null and name_key = public.exercise_key(new.name)
  ) then
    raise exception 'Ese ejercicio ya existe en el catálogo.' using errcode = '23505';
  end if;
  return new;
end; $$;

drop trigger if exists exercise_catalog_check_general on public.exercise_catalog;
create trigger exercise_catalog_check_general
  before insert or update of name on public.exercise_catalog
  for each row execute function public.exercise_catalog_check_general();

-- Ejercicios generales precargados -------------------------------------------
insert into public.exercise_catalog (name, muscle_group) values
  -- Pecho
  ('Press banca con barra', 'pecho'), ('Press banca con mancuernas', 'pecho'),
  ('Press plano en Smith', 'pecho'), ('Press inclinado con barra', 'pecho'),
  ('Press inclinado con mancuernas', 'pecho'), ('Press inclinado en Smith', 'pecho'),
  ('Press declinado con barra', 'pecho'), ('Press en máquina', 'pecho'),
  ('Press inclinado en máquina', 'pecho'), ('Aperturas con mancuernas', 'pecho'),
  ('Aperturas inclinadas con mancuernas', 'pecho'), ('Cruce de poleas', 'pecho'),
  ('Pec deck', 'pecho'), ('Flexiones de brazos', 'pecho'),
  -- Espalda
  ('Dominadas', 'espalda'), ('Dominadas supinas', 'espalda'),
  ('Jalón al pecho', 'espalda'), ('Jalón al pecho agarre cerrado', 'espalda'),
  ('Jalón tras nuca', 'espalda'), ('Remo con barra', 'espalda'),
  ('Remo con mancuerna a una mano', 'espalda'), ('Remo a un brazo', 'espalda'),
  ('Remo en polea baja', 'espalda'), ('Remo a caballo (barra T)', 'espalda'),
  ('Remo a caballo', 'espalda'), ('Remo a caballo en máquina', 'espalda'),
  ('Remo en máquina', 'espalda'), ('Pull over en polea alta', 'espalda'),
  ('Peso muerto', 'espalda'), ('Hiperextensiones lumbares', 'espalda'),
  ('Remo invertido', 'espalda'),
  -- Hombros
  ('Press militar con barra', 'hombros'), ('Press militar', 'hombros'),
  ('Press militar con mancuernas', 'hombros'), ('Press militar en máquina', 'hombros'),
  ('Press Arnold', 'hombros'), ('Vuelos laterales', 'hombros'),
  ('Vuelos laterales sentado', 'hombros'), ('Vuelos laterales en polea', 'hombros'),
  ('Vuelos frontales', 'hombros'), ('Vuelos posteriores (pájaros)', 'hombros'),
  ('Pec deck invertido', 'hombros'), ('Face pull', 'hombros'),
  ('Remo al mentón', 'hombros'), ('Encogimientos de hombros', 'hombros'),
  -- Bíceps
  ('Curl con barra', 'biceps'), ('Curl con barra Z', 'biceps'),
  ('Curl de bíceps con mancuernas', 'biceps'), ('Curl de bíceps martillo', 'biceps'),
  ('Curl concentrado', 'biceps'), ('Curl en banco Scott', 'biceps'),
  ('Curl en polea', 'biceps'), ('Curl inclinado con mancuernas', 'biceps'),
  -- Tríceps
  ('Press francés', 'triceps'), ('Extensión de tríceps en polea', 'triceps'),
  ('Extensión de tríceps con soga', 'triceps'), ('Extensión de tríceps tras nuca', 'triceps'),
  ('Patada de tríceps', 'triceps'), ('Patada de tríceps en polea', 'triceps'),
  ('Fondos en paralelas', 'triceps'), ('Fondos en banco', 'triceps'),
  ('Press banca agarre cerrado', 'triceps'), ('Extensión de tríceps a una mano', 'triceps'),
  -- Antebrazos
  ('Curl de muñeca', 'antebrazos'), ('Curl de muñeca inverso', 'antebrazos'),
  ('Paseo del granjero', 'antebrazos'),
  -- Cuádriceps
  ('Sentadilla con barra', 'cuadriceps'), ('Sentadilla', 'cuadriceps'),
  ('Sentadilla frontal', 'cuadriceps'), ('Sentadilla goblet', 'cuadriceps'),
  ('Sentadilla búlgara', 'cuadriceps'), ('Sentadilla en Smith', 'cuadriceps'),
  ('Prensa 45', 'cuadriceps'), ('Hack squat', 'cuadriceps'),
  ('Estocadas', 'cuadriceps'), ('Estocadas caminando', 'cuadriceps'),
  ('Extensión de cuádriceps (sillón)', 'cuadriceps'), ('Step up al cajón', 'cuadriceps'),
  ('Sentadilla sissy', 'cuadriceps'),
  -- Isquiotibiales
  ('Peso muerto rumano', 'isquiotibiales'), ('Peso muerto piernas rígidas', 'isquiotibiales'),
  ('Femorales acostado', 'isquiotibiales'), ('Femorales sentado', 'isquiotibiales'),
  ('Buenos días', 'isquiotibiales'), ('Curl nórdico', 'isquiotibiales'),
  -- Glúteos
  ('Hip thrust con barra', 'gluteos'), ('Hip thrust en máquina', 'gluteos'),
  ('Puente de glúteos', 'gluteos'), ('Patada de glúteo en polea', 'gluteos'),
  ('Patada de burro en polea', 'gluteos'), ('Patada de glúteo en máquina', 'gluteos'),
  ('Abducción en máquina', 'gluteos'), ('Abducción con banda', 'gluteos'),
  ('Sentadilla sumo', 'gluteos'), ('Peso muerto sumo', 'gluteos'),
  -- Aductores
  ('Aducción en máquina', 'aductores'), ('Sentadilla copenhague', 'aductores'),
  -- Pantorrillas
  ('Gemelos pierna extendida', 'pantorrillas'), ('Gemelos sentado', 'pantorrillas'),
  ('Gemelos en prensa', 'pantorrillas'), ('Gemelos a una pierna', 'pantorrillas'),
  -- Abdomen / Core
  ('Plancha', 'core'), ('Plancha lateral', 'core'), ('Abdominales crunch', 'core'),
  ('Crunch en polea', 'core'), ('Elevación de piernas colgado', 'core'),
  ('Elevación de piernas acostado', 'core'), ('Rueda abdominal', 'core'),
  ('Russian twist', 'core'), ('Bicho muerto (dead bug)', 'core'),
  ('Pallof press', 'core'), ('Abdominales bicicleta', 'core'), ('Hollow hold', 'core'),
  -- Full body / Funcional / Cardio
  ('Burpees', 'full_body'), ('Kettlebell swing', 'full_body'), ('Thruster', 'full_body'),
  ('Clean (cargada)', 'full_body'), ('Saltos al cajón', 'full_body'),
  ('Cinta / caminata', 'full_body'), ('Bicicleta fija', 'full_body'),
  ('Remo ergómetro', 'full_body')
on conflict do nothing;

-- Busca un ejercicio por nombre (general o propio del dueño) o lo crea como
-- propio del dueño. Lo usan el trigger de exercises y la migración.
create or replace function public.resolve_catalog_entry(p_owner uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_key text := public.exercise_key(p_name);
  v_id  uuid;
begin
  if v_key = '' then
    raise exception 'Cada ejercicio necesita un nombre.';
  end if;
  select id into v_id from public.exercise_catalog
   where name_key = v_key and (owner_id is null or owner_id = p_owner)
   order by owner_id nulls first
   limit 1;
  if v_id is null then
    insert into public.exercise_catalog (name, muscle_group, owner_id)
      values (btrim(regexp_replace(p_name, '\s+', ' ', 'g')), 'otros', p_owner)
      returning id into v_id;
  end if;
  return v_id;
end; $$;

-- Columnas nuevas en exercises -----------------------------------------------
alter table public.exercises
  add column if not exists catalog_id uuid references public.exercise_catalog(id) on delete restrict;
alter table public.exercises add column if not exists variant text;
create index if not exists exercises_catalog_idx on public.exercises (catalog_id);

-- Sincroniza catalog_id / variant / name en cada insert o update -------------
create or replace function public.exercises_sync_catalog()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner     uuid;
  v_cat_owner uuid;
  v_cat_name  text;
  v_label     text;
begin
  select r.owner_id into v_owner
    from public.routine_days d join public.routines r on r.id = d.routine_id
   where d.id = new.day_id;

  new.variant := nullif(btrim(coalesce(new.variant, '')), '');

  -- App vieja que renombra el ejercicio por texto: se vuelve a buscar por nombre.
  if tg_op = 'UPDATE'
     and new.catalog_id is not distinct from old.catalog_id
     and new.name is distinct from old.name then
    select name into v_cat_name from public.exercise_catalog where id = new.catalog_id;
    v_label := v_cat_name || coalesce(' (' || new.variant || ')', '');
    if new.name is distinct from v_label then
      new.catalog_id := null;
      new.variant := null;
    end if;
  end if;

  if new.catalog_id is null then
    new.catalog_id := public.resolve_catalog_entry(v_owner, new.name);
  end if;

  select owner_id, name into v_cat_owner, v_cat_name
    from public.exercise_catalog where id = new.catalog_id;
  if v_cat_name is null then
    raise exception 'El ejercicio elegido no existe.';
  end if;
  -- Solo se pueden usar ejercicios generales o propios del dueño de la rutina.
  if v_cat_owner is not null and v_cat_owner is distinct from v_owner then
    raise exception 'No podés usar ese ejercicio.';
  end if;

  new.name := v_cat_name || coalesce(' (' || new.variant || ')', '');
  return new;
end; $$;

drop trigger if exists exercises_sync_catalog on public.exercises;
create trigger exercises_sync_catalog
  before insert or update on public.exercises
  for each row execute function public.exercises_sync_catalog();

-- Si se renombra un ejercicio del catálogo, se actualiza en todas las rutinas.
create or replace function public.exercise_catalog_propagate_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.exercises
     set name = new.name || coalesce(' (' || variant || ')', '')
   where catalog_id = new.id;
  return new;
end; $$;

drop trigger if exists exercise_catalog_propagate_name on public.exercise_catalog;
create trigger exercise_catalog_propagate_name
  after update of name on public.exercise_catalog
  for each row execute function public.exercise_catalog_propagate_name();

-- Vincular los ejercicios existentes (el trigger resuelve cada nombre) -------
update public.exercises set variant = variant where catalog_id is null;
alter table public.exercises alter column catalog_id set not null;

-- RLS -------------------------------------------------------------------------
alter table public.exercise_catalog enable row level security;

-- ¿El ejercicio del catálogo aparece en alguna rutina a la que tengo acceso?
-- (así el alumno ve el nombre de los ejercicios propios de su coach).
create or replace function public.catalog_used_in_my_routines(p_catalog_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exercises e
    where e.catalog_id = p_catalog_id and public.has_day_access(e.day_id)
  )
$$;

drop policy if exists exercise_catalog_select on public.exercise_catalog;
create policy exercise_catalog_select on public.exercise_catalog for select
  using (
    owner_id is null
    or owner_id = auth.uid()
    or public.catalog_used_in_my_routines(id)
  );

drop policy if exists exercise_catalog_insert on public.exercise_catalog;
create policy exercise_catalog_insert on public.exercise_catalog for insert
  with check (owner_id = auth.uid());

drop policy if exists exercise_catalog_update on public.exercise_catalog;
create policy exercise_catalog_update on public.exercise_catalog for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists exercise_catalog_delete on public.exercise_catalog;
create policy exercise_catalog_delete on public.exercise_catalog for delete
  using (owner_id = auth.uid());

-- RPCs de rutinas: aceptan catalog_id + variant (y siguen aceptando name) -----
-- p_days: [{ "id"?, "name", "exercises": [{ "id"?, "catalog_id"?, "variant"?, "name"?, "sets_reps" }] }]
create or replace function public.create_full_routine(
  p_name      text,
  p_folder_id uuid,
  p_days      jsonb
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

  insert into public.routines (owner_id, folder_id, name)
    values (auth.uid(), p_folder_id, coalesce(p_name, ''))
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

create or replace function public.update_full_routine(
  p_routine_id uuid,
  p_name       text,
  p_folder_id  uuid,
  p_days       jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_day     jsonb;
  v_day_id  uuid;
  v_ex      jsonb;
  v_day_pos int := 0;
  v_ex_pos  int;
begin
  if not public.is_routine_owner(p_routine_id) then
    raise exception 'No autorizado';
  end if;

  update public.routines
     set name = coalesce(p_name, name),
         folder_id = p_folder_id,
         updated_at = now()
   where id = p_routine_id;

  delete from public.routine_days
   where routine_id = p_routine_id
     and id not in (
       select (d->>'id')::uuid
       from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) d
       where d->>'id' is not null
     );

  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb))
  loop
    if v_day->>'id' is not null then
      v_day_id := (v_day->>'id')::uuid;
      update public.routine_days
         set name = coalesce(v_day->>'name', ''), position = v_day_pos
       where id = v_day_id and routine_id = p_routine_id;
    else
      insert into public.routine_days (routine_id, name, position)
        values (p_routine_id, coalesce(v_day->>'name', ''), v_day_pos)
        returning id into v_day_id;
    end if;
    v_day_pos := v_day_pos + 1;

    delete from public.exercises
     where day_id = v_day_id
       and id not in (
         select (e->>'id')::uuid
         from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb)) e
         where e->>'id' is not null
       );

    v_ex_pos := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb))
    loop
      if v_ex->>'id' is not null then
        if v_ex ? 'catalog_id' then
          -- App nueva: elige del catálogo (el trigger arma el nombre).
          update public.exercises
             set catalog_id = (v_ex->>'catalog_id')::uuid,
                 variant = v_ex->>'variant',
                 sets_reps = coalesce(v_ex->>'sets_reps', ''),
                 position = v_ex_pos
           where id = (v_ex->>'id')::uuid and day_id = v_day_id;
        else
          -- App vieja: solo nombre (el trigger lo busca en el catálogo).
          update public.exercises
             set name = coalesce(v_ex->>'name', ''),
                 sets_reps = coalesce(v_ex->>'sets_reps', ''),
                 position = v_ex_pos
           where id = (v_ex->>'id')::uuid and day_id = v_day_id;
        end if;
      else
        insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, position)
          values (
            v_day_id,
            nullif(v_ex->>'catalog_id', '')::uuid,
            v_ex->>'variant',
            coalesce(v_ex->>'name', ''),
            coalesce(v_ex->>'sets_reps', ''),
            v_ex_pos
          );
      end if;
      v_ex_pos := v_ex_pos + 1;
    end loop;
  end loop;

  return p_routine_id;
end; $$;
