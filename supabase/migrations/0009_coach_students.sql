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
