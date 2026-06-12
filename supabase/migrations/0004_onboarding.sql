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
