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
