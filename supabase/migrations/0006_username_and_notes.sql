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
