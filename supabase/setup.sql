-- Brabus Fit — Setup completo (0001 + 0002 + 0003). Pegar entero en el SQL Editor de Supabase.


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

