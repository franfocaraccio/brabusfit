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
