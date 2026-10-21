-- Brabus Fit - Setup completo (0001..0013). Pegar entero en el SQL Editor de Supabase.


-- ============================ 0001_init.sql ============================

-- ============================================================================
-- Brabus Fit — Esquema inicial
-- Ejecutar en el SQL Editor de Supabase (o vía `supabase db push`).
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

-- updated_at automático -------------------------------------------------------
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

  -- Vincula rutinas que ya le habían compartido por email (estado pendiente).
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
-- HELPERS DE ACCESO (SECURITY DEFINER para evitar recursión de RLS)
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

-- ¿Ese perfil (un coach) me compartió alguna rutina a mí?
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
-- Brabus Fit — Funciones RPC para crear/editar rutinas completas (atómico)
-- ============================================================================

-- Crear rutina con sus días y ejercicios en una sola transacción ---------------
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

-- Editar rutina completa con diff por id (preserva ids no modificados, así no
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

  -- Borra los días que ya no están en el payload.
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

    -- Borra los ejercicios de este día que ya no están.
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
-- Brabus Fit — Compartir rutina por email
-- ============================================================================

-- Comparte una rutina con un email. Si ya existe un usuario con ese email, la
-- vincula al instante (status accepted); si no, la deja pendiente y el trigger
-- on_auth_user_created la vinculará cuando esa persona cree su cuenta.
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
    raise exception 'No sos dueño de esta rutina';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Email inválido';
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
-- Brabus Fit — Onboarding de perfil + fix de nombre/apellido para SSO (Google)
-- ============================================================================

-- 1) Columna onboarded: marca si el usuario ya completó sus datos.
alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- 2) Backfill: los usuarios que ya tienen apellido (altas por email/contraseña)
--    se consideran completos. Los de Google (sin apellido) quedan pendientes.
update public.profiles
   set onboarded = true
 where coalesce(last_name, '') <> '';

-- 3) Trigger de alta: usa given_name/family_name de Google y marca onboarded.
--    - Alta por email/contraseña: el metadata incluye 'is_coach' => onboarded = true.
--    - Alta por Google: no incluye 'is_coach' => onboarded = false (irá a /completar-perfil).
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
-- Brabus Fit — Validaciones al compartir rutinas
--   * No se puede compartir con un coach
--   * No se puede compartir con uno mismo
--   * Función de validación en vivo (mientras se escribe el email)
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
    raise exception 'No sos dueño de esta rutina';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Email inválido';
  end if;

  -- No compartir con uno mismo.
  if v_email = (select lower(email) from auth.users where id = v_uid) then
    raise exception 'No podés compartirte una rutina a vos mismo';
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
    raise exception 'No podés compartir una rutina con un coach';
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

-- 2) Validación en vivo: devuelve el estado del email para el feedback del UI.
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
-- Brabus Fit — Nombre de usuario (username) + nota por ejercicio
-- ============================================================================

-- 1) username en profiles (único, case-insensitive). Nullable: los usuarios
--    existentes se completan a mano; los de Google en /completar-perfil.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username));

-- 2) Nota opcional por ejercicio dentro de una sesión de entrenamiento.
alter table public.exercise_logs add column if not exists note text;

-- 3) ¿Está disponible este username? (callable por anon durante el signup)
create or replace function public.username_available(p_username text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(p_username))
      and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

-- 4) Validación en vivo para compartir por username.
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
--    (que ya valida dueño, self y coach).
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


-- ============================ 0009_coach_students.sql ============================

-- ============================================================================
-- Brabus Fit — Relación explícita coach ↔ alumno
-- ============================================================================
-- - coach_students: un coach invita a un alumno (por usuario o email). Queda
--   "pending" hasta que el alumno acepta ("active"). Muchos a muchos: un alumno
--   puede tener varios coaches y un coach varios alumnos.
-- - El coach puede compartirle cosas mientras la invitación está pendiente; el
--   alumno recién las ve cuando acepta.
-- - Desvincular (coach): puede elegir que el alumno conserve las rutinas
--   (routine_shares.kept = true). Si el alumno se desvincula o rechaza, pierde
--   todo lo que ese coach le compartía.
-- - El coach solo ve los entrenamientos del alumno mientras el vínculo está activo.
-- ============================================================================

create table if not exists public.coach_students (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles(id) on delete cascade,
  student_id    uuid references public.profiles(id) on delete cascade,
  student_email text not null,
  status        text not null default 'pending' check (status in ('pending', 'active')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  check (student_id is null or student_id <> coach_id)
);
create unique index if not exists coach_students_email_unique
  on public.coach_students (coach_id, lower(student_email));
create unique index if not exists coach_students_student_unique
  on public.coach_students (coach_id, student_id) where student_id is not null;
create index if not exists coach_students_student_idx on public.coach_students (student_id);

-- Rutinas que el alumno conserva después de que el coach lo desvinculó.
alter table public.routine_shares add column if not exists kept boolean not null default false;

-- Vínculos existentes a partir de las rutinas ya compartidas -----------------
insert into public.coach_students (coach_id, student_id, student_email, status, accepted_at)
select distinct on (s.shared_by, lower(s.shared_with_email))
       s.shared_by,
       s.shared_with_user_id,
       lower(s.shared_with_email),
       case when s.shared_with_user_id is not null then 'active' else 'pending' end,
       case when s.shared_with_user_id is not null then now() end
  from public.routine_shares s
 order by s.shared_by, lower(s.shared_with_email), s.shared_with_user_id nulls last
on conflict do nothing;

-- Helpers de permisos -----------------------------------------------------------

-- ¿Vínculo activo entre este coach y este alumno?
create or replace function public.is_active_link(p_coach uuid, p_student uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = p_coach and student_id = p_student and status = 'active'
  );
$$;

-- El coach ve el perfil de sus alumnos (también pendientes, para mostrar el nombre).
create or replace function public.is_my_student(p_profile_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = auth.uid() and student_id = p_profile_id
  ) or exists (
    select 1 from public.routine_shares
    where shared_by = auth.uid() and shared_with_user_id = p_profile_id
  );
$$;

-- El alumno ve el perfil de sus coaches (también si lo invitaron, para el aviso).
create or replace function public.shared_a_routine_with_me(p_profile_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = p_profile_id and student_id = auth.uid()
  ) or exists (
    select 1 from public.routine_shares
    where shared_by = p_profile_id and shared_with_user_id = auth.uid()
  );
$$;

-- Acceso a una rutina: dueño, o compartida con vínculo activo (o conservada).
create or replace function public.has_routine_access(p_routine_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.routines
    where id = p_routine_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.routine_shares s
    where s.routine_id = p_routine_id
      and s.shared_with_user_id = auth.uid()
      and (s.kept or public.is_active_link(s.shared_by, auth.uid()))
  );
$$;

-- Ver una sesión: la propia, o la de un alumno activo en una rutina mía.
create or replace function public.can_view_session(p_session_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.workout_sessions s
    where s.id = p_session_id
      and (
        s.user_id = auth.uid()
        or (public.is_routine_owner(s.routine_id) and public.is_active_link(auth.uid(), s.user_id))
      )
  );
$$;

drop policy if exists sessions_select on public.workout_sessions;
create policy sessions_select on public.workout_sessions for select
  using (
    user_id = auth.uid()
    or (public.is_routine_owner(routine_id) and public.is_active_link(auth.uid(), user_id))
  );

-- Las rutinas compartidas solo las ve el alumno si puede acceder a la rutina.
drop policy if exists shares_select on public.routine_shares;
create policy shares_select on public.routine_shares for select
  using (
    shared_by = auth.uid()
    or (shared_with_user_id = auth.uid() and public.has_routine_access(routine_id))
  );

-- RLS de coach_students ---------------------------------------------------------
alter table public.coach_students enable row level security;

drop policy if exists coach_students_select on public.coach_students;
create policy coach_students_select on public.coach_students for select
  using (coach_id = auth.uid() or student_id = auth.uid());
-- Altas, cambios y bajas solo por las funciones de abajo (validan reglas).

-- Validación en vivo al agregar un alumno ---------------------------------------
-- Estados: forbidden | invalid | not_found | self | coach | already | existing | new
create or replace function public.validate_add_student(p_mode text, p_value text)
returns text
language plpgsql security definer set search_path = public stable as $$
declare
  v_uid    uuid := auth.uid();
  v_value  text := lower(trim(p_value));
  v_target uuid;
  v_email  text;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and is_coach) then
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
    where coach_id = v_uid
      and (student_id = v_target or lower(student_email) = v_email)
  ) then
    return 'already';
  end if;
  return case when v_target is not null then 'existing' else 'new' end;
end; $$;

-- Agregar alumno (invitación pendiente) -----------------------------------------
create or replace function public.add_student(p_mode text, p_value text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_status text := public.validate_add_student(p_mode, p_value);
  v_value  text := lower(trim(p_value));
  v_target uuid;
  v_email  text;
  v_id     uuid;
begin
  case v_status
    when 'forbidden' then raise exception 'Solo los coaches pueden agregar alumnos.';
    when 'invalid'   then raise exception 'Revisá el email o usuario.';
    when 'not_found' then raise exception 'No existe un usuario con ese nombre.';
    when 'self'      then raise exception 'No podés agregarte a vos mismo.';
    when 'coach'     then raise exception 'No podés agregar a un coach como alumno.';
    when 'already'   then raise exception 'Ya es tu alumno (o tiene una invitación pendiente).';
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

  insert into public.coach_students (coach_id, student_id, student_email, status)
    values (v_uid, v_target, v_email, 'pending')
    returning id into v_id;

  return jsonb_build_object('id', v_id, 'existed', v_target is not null, 'email', v_email);
end; $$;

-- Responder una invitación (alumno) ----------------------------------------------
create or replace function public.respond_invitation(p_link_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_coach uuid;
begin
  select coach_id into v_coach from public.coach_students
   where id = p_link_id and student_id = auth.uid() and status = 'pending';
  if v_coach is null then
    raise exception 'La invitación ya no existe.';
  end if;

  if p_accept then
    update public.coach_students
       set status = 'active', accepted_at = now()
     where id = p_link_id;
  else
    delete from public.routine_shares
     where shared_by = v_coach and shared_with_user_id = auth.uid() and not kept;
    delete from public.coach_students where id = p_link_id;
  end if;
end; $$;

-- Desvincular desde el coach (puede dejarle las rutinas) -------------------------
create or replace function public.unlink_student(p_link_id uuid, p_keep_routines boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link public.coach_students;
begin
  select * into v_link from public.coach_students
   where id = p_link_id and coach_id = auth.uid();
  if v_link.id is null then
    raise exception 'Ese alumno no está vinculado a vos.';
  end if;

  if p_keep_routines and v_link.status = 'active' then
    update public.routine_shares
       set kept = true
     where shared_by = v_link.coach_id
       and (shared_with_user_id = v_link.student_id
            or lower(shared_with_email) = lower(v_link.student_email));
  else
    delete from public.routine_shares
     where shared_by = v_link.coach_id
       and not kept
       and (shared_with_user_id = v_link.student_id
            or lower(shared_with_email) = lower(v_link.student_email));
  end if;

  delete from public.coach_students where id = p_link_id;
end; $$;

-- Desvincularse desde el alumno (pierde todo lo de ese coach) --------------------
create or replace function public.leave_coach(p_link_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_coach uuid;
begin
  select coach_id into v_coach from public.coach_students
   where id = p_link_id and student_id = auth.uid();
  if v_coach is null then
    raise exception 'Ese coach no está vinculado a vos.';
  end if;

  delete from public.routine_shares
   where shared_by = v_coach and shared_with_user_id = auth.uid();
  delete from public.coach_students where id = p_link_id;
end; $$;

-- Compartir / dejar de compartir una rutina con un alumno vinculado --------------
create or replace function public.set_routine_share(
  p_routine_id uuid,
  p_link_id    uuid,
  p_shared     boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link public.coach_students;
begin
  if not public.is_routine_owner(p_routine_id) then
    raise exception 'No sos dueño de esta rutina.';
  end if;
  select * into v_link from public.coach_students
   where id = p_link_id and coach_id = auth.uid();
  if v_link.id is null then
    raise exception 'Ese alumno no está vinculado a vos.';
  end if;

  if p_shared then
    insert into public.routine_shares (
      routine_id, shared_by, shared_with_email, shared_with_user_id, status, accepted_at
    ) values (
      p_routine_id, auth.uid(), lower(v_link.student_email), v_link.student_id,
      case when v_link.student_id is not null then 'accepted'::public.share_status
           else 'pending'::public.share_status end,
      case when v_link.student_id is not null then now() end
    )
    on conflict (routine_id, shared_with_email) do update
      set shared_with_user_id = excluded.shared_with_user_id,
          status = excluded.status,
          kept = false;
  else
    delete from public.routine_shares
     where routine_id = p_routine_id
       and lower(shared_with_email) = lower(v_link.student_email);
  end if;
end; $$;

-- Compatibilidad: la app vieja comparte por email/usuario → crea el vínculo ------
create or replace function public.routine_shares_ensure_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.coach_students (coach_id, student_id, student_email, status)
    values (new.shared_by, new.shared_with_user_id, lower(new.shared_with_email), 'pending')
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists routine_shares_ensure_link on public.routine_shares;
create trigger routine_shares_ensure_link
  after insert on public.routine_shares
  for each row execute function public.routine_shares_ensure_link();

-- Alta de usuario: vincula invitaciones y rutinas pendientes por email -----------
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
       and student_id is null;

    update public.routine_shares
       set shared_with_user_id = new.id,
           status = 'accepted',
           accepted_at = now()
     where lower(shared_with_email) = lower(new.email)
       and shared_with_user_id is null;
  end if;

  return new;
end; $$;


-- ============================ 0010_student_routines.sql ============================

-- ============================================================================
-- Brabus Fit — Rutinas por alumno (reemplaza "compartir")
-- ============================================================================
-- - Plantillas: rutinas del coach sin alumno asignado (en sus carpetas). Nadie
--   más las ve; sirven para crear rutinas nuevas.
-- - Rutina de alumno: rutina del coach asignada a UN alumno (routines.student_id /
--   student_email). La edita solo el coach; editarla no afecta a nadie más.
--   "Asignar plantilla" crea una copia independiente.
-- - El alumno la ve mientras el vínculo esté activo. Si se desvincula (lo haga
--   quien lo haga), el alumno la pierde y al coach le queda guardada. Si se
--   vuelven a vincular, el alumno la recupera.
-- - El alumno sigue viendo su propio historial (series y nombres de los
--   ejercicios que entrenó) aunque ya no tenga la rutina.
-- - Datos existentes: cada alumno que tenía una rutina compartida (o que entrenó
--   en una rutina ajena) recibe su copia propia y se le mudan sus entrenamientos.
--   La rutina original queda como plantilla del coach.
-- - Se elimina routine_shares y las funciones de compartir.
-- ============================================================================

alter table public.routines
  add column if not exists student_id    uuid references public.profiles(id) on delete set null,
  add column if not exists student_email text;
create index if not exists routines_student_idx on public.routines (student_id);
create index if not exists routines_owner_student_idx on public.routines (owner_id, lower(student_email));

-- Copia completa de una rutina (días + ejercicios). Uso interno: devuelve el
-- id nuevo y el mapeo de ids viejos → nuevos para mudar entrenamientos.
create or replace function public._copy_routine(
  p_src           uuid,
  p_name          text,
  p_folder_id     uuid,
  p_student_id    uuid,
  p_student_email text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_src     public.routines;
  v_new     uuid;
  v_day     record;
  v_new_day uuid;
  v_ex      record;
  v_new_ex  uuid;
  v_days    jsonb := '{}'::jsonb;
  v_exs     jsonb := '{}'::jsonb;
begin
  select * into v_src from public.routines where id = p_src;
  if v_src.id is null then
    raise exception 'No se encontró la rutina.';
  end if;

  insert into public.routines (owner_id, folder_id, name, student_id, student_email)
    values (v_src.owner_id, p_folder_id, coalesce(p_name, v_src.name), p_student_id, lower(p_student_email))
    returning id into v_new;

  for v_day in
    select * from public.routine_days where routine_id = p_src order by position, created_at
  loop
    insert into public.routine_days (routine_id, name, position)
      values (v_new, v_day.name, v_day.position)
      returning id into v_new_day;
    v_days := v_days || jsonb_build_object(v_day.id::text, v_new_day);

    for v_ex in
      select * from public.exercises where day_id = v_day.id order by position, created_at
    loop
      insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, position)
        values (v_new_day, v_ex.catalog_id, v_ex.variant, v_ex.name, v_ex.sets_reps, v_ex.position)
        returning id into v_new_ex;
      v_exs := v_exs || jsonb_build_object(v_ex.id::text, v_new_ex);
    end loop;
  end loop;

  return jsonb_build_object('id', v_new, 'days', v_days, 'exercises', v_exs);
end; $$;

revoke all on function public._copy_routine(uuid, text, uuid, uuid, text) from public, anon, authenticated;

-- Datos existentes: una copia por alumno + mudanza de sus entrenamientos -------
do $$
declare
  v_t   record;
  v_map jsonb;
  v_new uuid;
begin
  for v_t in
    select distinct on (t.routine_id, t.email) t.routine_id, t.email, t.user_id
      from (
        select s.routine_id, lower(s.shared_with_email) as email, s.shared_with_user_id as user_id
          from public.routine_shares s
        union
        select ws.routine_id, lower(u.email), ws.user_id
          from public.workout_sessions ws
          join public.routines r on r.id = ws.routine_id
          join auth.users u on u.id = ws.user_id
         where ws.user_id <> r.owner_id
      ) t
     order by t.routine_id, t.email, t.user_id nulls last
  loop
    v_map := public._copy_routine(v_t.routine_id, null, null, v_t.user_id, v_t.email);
    v_new := (v_map->>'id')::uuid;

    if v_t.user_id is not null then
      update public.workout_sessions
         set routine_id = v_new,
             day_id = (v_map->'days'->>day_id::text)::uuid
       where routine_id = v_t.routine_id
         and user_id = v_t.user_id
         and v_map->'days' ? day_id::text;

      update public.exercise_logs l
         set exercise_id = (v_map->'exercises'->>l.exercise_id::text)::uuid
        from public.workout_sessions ws
       where ws.id = l.session_id
         and ws.routine_id = v_new
         and v_map->'exercises' ? l.exercise_id::text;
    end if;
  end loop;
end $$;

-- Validación: solo se asigna a un alumno vinculado al dueño --------------------
create or replace function public.routines_check_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.student_email := lower(trim(new.student_email));
  if new.student_email = '' then new.student_email := null; end if;

  if new.student_email is null then
    new.student_id := null;
    return new;
  end if;

  -- Las rutinas de alumno no van en carpetas (se agrupan por alumno).
  new.folder_id := null;

  -- Mismo alumno (o se borró su cuenta: student_id pasa a null): nada que validar.
  if tg_op = 'UPDATE'
     and new.student_email is not distinct from old.student_email
     and (new.student_id is null or new.student_id is not distinct from old.student_id) then
    return new;
  end if;

  if not exists (
    select 1 from public.coach_students c
     where c.coach_id = new.owner_id
       and (c.student_id = new.student_id or lower(c.student_email) = new.student_email)
  ) then
    raise exception 'Ese alumno no está vinculado a vos.';
  end if;
  return new;
end; $$;

drop trigger if exists routines_check_student on public.routines;
create trigger routines_check_student
  before insert or update of student_id, student_email, folder_id on public.routines
  for each row execute function public.routines_check_student();

-- Fuera "compartir" -------------------------------------------------------------
drop trigger if exists routine_shares_ensure_link on public.routine_shares;
drop function if exists public.routine_shares_ensure_link();
drop function if exists public.set_routine_share(uuid, uuid, boolean);
drop function if exists public.share_routine(uuid, text);
drop function if exists public.share_routine_by_username(uuid, text);
drop function if exists public.validate_share_email(uuid, text);
drop function if exists public.validate_share_username(uuid, text);

-- Helpers que leían routine_shares (se redefinen antes de borrar la tabla).
create or replace function public.is_my_student(p_profile_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = auth.uid() and student_id = p_profile_id
  );
$$;

create or replace function public.shared_a_routine_with_me(p_profile_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = p_profile_id and student_id = auth.uid()
  ) or exists (
    -- El dueño de una rutina que entrené (para mostrar su nombre en el historial).
    select 1 from public.routines r
    where r.owner_id = p_profile_id and r.student_id = auth.uid()
  );
$$;

-- Acceso a una rutina: dueño, o alumno asignado con vínculo activo.
create or replace function public.has_routine_access(p_routine_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id
      and (
        r.owner_id = auth.uid()
        or (r.student_id = auth.uid() and public.is_active_link(r.owner_id, auth.uid()))
      )
  );
$$;

drop table if exists public.routine_shares;

-- Historial propio aunque ya no tenga la rutina ---------------------------------
create or replace function public.trained_day(p_day_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.workout_sessions
    where day_id = p_day_id and user_id = auth.uid()
  );
$$;

create or replace function public.trained_exercise(p_exercise_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.exercise_logs l
    join public.workout_sessions s on s.id = l.session_id
    where l.exercise_id = p_exercise_id and s.user_id = auth.uid()
  );
$$;

drop policy if exists routine_days_select on public.routine_days;
create policy routine_days_select on public.routine_days for select
  using (public.has_routine_access(routine_id) or public.trained_day(id));

drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select
  using (public.has_day_access(day_id) or public.trained_exercise(id));

create or replace function public.catalog_used_in_my_routines(p_catalog_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exercises e
    where e.catalog_id = p_catalog_id
      and (public.has_day_access(e.day_id) or public.trained_exercise(e.id))
  )
$$;

-- Crear rutina (plantilla, o para un alumno con p_link_id) ---------------------
drop function if exists public.create_full_routine(text, uuid, jsonb);
create or replace function public.create_full_routine(
  p_name      text,
  p_folder_id uuid,
  p_days      jsonb,
  p_link_id   uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_routine_id uuid;
  v_link       public.coach_students;
  v_day        jsonb;
  v_day_id     uuid;
  v_ex         jsonb;
  v_day_pos    int := 0;
  v_ex_pos     int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_link_id is not null then
    select * into v_link from public.coach_students
     where id = p_link_id and coach_id = auth.uid();
    if v_link.id is null then
      raise exception 'Ese alumno no está vinculado a vos.';
    end if;
  end if;

  insert into public.routines (owner_id, folder_id, name, student_id, student_email)
    values (
      auth.uid(),
      case when v_link.id is null then p_folder_id end,
      coalesce(p_name, ''),
      v_link.student_id,
      v_link.student_email
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

-- Copiar una rutina propia: a un alumno (p_link_id) o como plantilla nueva ------
create or replace function public.copy_routine(p_routine_id uuid, p_link_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_src  public.routines;
  v_link public.coach_students;
begin
  select * into v_src from public.routines where id = p_routine_id and owner_id = auth.uid();
  if v_src.id is null then
    raise exception 'No sos dueño de esta rutina.';
  end if;

  if p_link_id is null then
    return (public._copy_routine(
      p_routine_id, v_src.name || ' (copia)', v_src.folder_id, null, null
    )->>'id')::uuid;
  end if;

  select * into v_link from public.coach_students
   where id = p_link_id and coach_id = auth.uid();
  if v_link.id is null then
    raise exception 'Ese alumno no está vinculado a vos.';
  end if;

  return (public._copy_routine(
    p_routine_id, v_src.name, null, v_link.student_id, v_link.student_email
  )->>'id')::uuid;
end; $$;

-- Vínculo: desvincular / rechazar / irse ya no borran rutinas -------------------
-- (al coach le quedan; el alumno las pierde porque no hay vínculo activo).
create or replace function public.unlink_student(p_link_id uuid, p_keep_routines boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.coach_students where id = p_link_id and coach_id = auth.uid();
  if not found then
    raise exception 'Ese alumno no está vinculado a vos.';
  end if;
end; $$;

create or replace function public.respond_invitation(p_link_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.coach_students
     where id = p_link_id and student_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'La invitación ya no existe.';
  end if;

  if p_accept then
    update public.coach_students
       set status = 'active', accepted_at = now()
     where id = p_link_id;
  else
    delete from public.coach_students where id = p_link_id;
  end if;
end; $$;

create or replace function public.leave_coach(p_link_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.coach_students where id = p_link_id and student_id = auth.uid();
  if not found then
    raise exception 'Ese coach no está vinculado a vos.';
  end if;
end; $$;

-- Alta de usuario: vincula invitaciones y rutinas asignadas por email ----------
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
       and student_id is null;

    update public.routines
       set student_id = new.id
     where student_email = lower(new.email)
       and student_id is null;
  end if;

  return new;
end; $$;


-- ============================ 0011_keep_routines_on_unlink.sql ============================

-- ============================================================================
-- Brabus Fit — Al desvincularse, el alumno se queda con sus rutinas
-- ============================================================================
-- - El alumno pagó por el asesoramiento: cuando se corta un vínculo ACTIVO (lo
--   corte el coach o el alumno), el alumno recibe una copia propia de cada
--   rutina que el coach le armó. Va a "Mis rutinas", la puede editar y no
--   depende más del coach. Sus entrenamientos se mudan a esa copia (historial y
--   progreso intactos).
-- - El coach conserva la suya (queda bajo el alumno como "Desvinculado").
-- - Cancelar una invitación pendiente o rechazarla no le deja nada al alumno.
-- - Los ejercicios propios del coach que usa la rutina se copian como
--   ejercicios propios del alumno (mismo nombre y grupo muscular).
-- ============================================================================

-- Copia de rutina con dueño opcional (por defecto, el mismo dueño) -------------
drop function if exists public._copy_routine(uuid, text, uuid, uuid, text);
create or replace function public._copy_routine(
  p_src           uuid,
  p_name          text,
  p_folder_id     uuid,
  p_student_id    uuid,
  p_student_email text,
  p_owner         uuid default null
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

  insert into public.routines (owner_id, folder_id, name, student_id, student_email)
    values (v_owner, p_folder_id, coalesce(p_name, v_src.name), p_student_id, lower(p_student_email))
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

revoke all on function public._copy_routine(uuid, text, uuid, uuid, text, uuid) from public, anon, authenticated;

-- Entregarle al alumno sus rutinas del coach (copia propia + sus entrenamientos)
create or replace function public._hand_over_routines(p_coach uuid, p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_r   record;
  v_map jsonb;
  v_new uuid;
begin
  if p_student is null then return; end if;

  for v_r in
    select id from public.routines where owner_id = p_coach and student_id = p_student
  loop
    v_map := public._copy_routine(v_r.id, null, null, null, null, p_student);
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

-- Desvincular desde el coach ------------------------------------------------------
create or replace function public.unlink_student(p_link_id uuid, p_keep_routines boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link public.coach_students;
begin
  select * into v_link from public.coach_students
   where id = p_link_id and coach_id = auth.uid();
  if v_link.id is null then
    raise exception 'Ese alumno no está vinculado a vos.';
  end if;

  if v_link.status = 'active' then
    perform public._hand_over_routines(v_link.coach_id, v_link.student_id);
  end if;
  delete from public.coach_students where id = p_link_id;
end; $$;

-- Desvincularse desde el alumno (funciona igual) ----------------------------------
create or replace function public.leave_coach(p_link_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link public.coach_students;
begin
  select * into v_link from public.coach_students
   where id = p_link_id and student_id = auth.uid();
  if v_link.id is null then
    raise exception 'Ese coach no está vinculado a vos.';
  end if;

  if v_link.status = 'active' then
    perform public._hand_over_routines(v_link.coach_id, v_link.student_id);
  end if;
  delete from public.coach_students where id = p_link_id;
end; $$;

-- Ex alumnos que ya habían quedado sin vínculo y entrenaron esas rutinas -------
do $$
declare
  v_pair record;
begin
  for v_pair in
    select distinct r.owner_id, r.student_id
      from public.routines r
     where r.student_id is not null
       and not exists (
         select 1 from public.coach_students c
          where c.coach_id = r.owner_id and c.student_id = r.student_id
       )
       and exists (
         select 1 from public.workout_sessions s
          where s.routine_id = r.id and s.user_id = r.student_id
       )
  loop
    perform public._hand_over_routines(v_pair.owner_id, v_pair.student_id);
  end loop;
end $$;


-- ============================ 0012_clients_crm.sql ============================

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


-- ============================ 0013_nutrition.sql ============================

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
