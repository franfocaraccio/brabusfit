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
