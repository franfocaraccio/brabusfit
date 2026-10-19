-- ============================================================================
-- Datos de prueba SOLO para el Supabase local (`npx supabase start` / `db reset`).
-- Nunca correr en producción.
--
-- Usuarios (contraseña de todos: brabus-test-123):
--   coach@brabus.test    coach_test   coach
--   coach2@brabus.test   coach_dos    coach (para probar "no se comparte a coaches")
--   alumno@brabus.test   alumno_test  alumno con rutina compartida + entrenamientos
--   alumno2@brabus.test  alumno_dos   alumno sin rutinas
-- ============================================================================

create or replace function pg_temp.seed_user(
  p_id uuid, p_email text, p_meta jsonb
) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, crypt('brabus-test-123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', p_meta, now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text, 'email',
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );
end $$;

select pg_temp.seed_user('11111111-1111-1111-1111-111111111111', 'coach@brabus.test',
  '{"first_name":"Carla","last_name":"Coach","username":"coach_test","is_coach":true,"birth_date":"1990-05-10","height_cm":"168","weight_kg":"62"}');
select pg_temp.seed_user('22222222-2222-2222-2222-222222222222', 'coach2@brabus.test',
  '{"first_name":"Diego","last_name":"Entrenador","username":"coach_dos","is_coach":true}');
select pg_temp.seed_user('33333333-3333-3333-3333-333333333333', 'alumno@brabus.test',
  '{"first_name":"Andrés","last_name":"Alumno","username":"alumno_test","is_coach":false,"birth_date":"1998-02-20","height_cm":"180","weight_kg":"78.5"}');
select pg_temp.seed_user('44444444-4444-4444-4444-444444444444', 'alumno2@brabus.test',
  '{"first_name":"Belén","last_name":"Alumna","username":"alumno_dos","is_coach":false}');

-- Rutina del coach en una carpeta, compartida con alumno_test ---------------
insert into public.folders (id, owner_id, name) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Fuerza'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Hipertrofia');

insert into public.routines (id, owner_id, folder_id, name) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000000001', 'Fuerza 3 días'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000000002', 'Torso / Pierna');

insert into public.routine_days (id, routine_id, name, position) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Día 1 - Empuje', 0),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Día 2 - Tirón', 1),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Día 3 - Pierna', 2),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Torso', 0);

insert into public.exercises (id, day_id, name, sets_reps, position) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Press banca', '4x6-8', 0),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Press militar', '3x8', 1),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Fondos', '3 x al fallo', 2),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'Dominadas', '4x6', 0),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'Remo con barra', '4x8', 1),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000003', 'Sentadilla', '5x5', 0),
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'Peso muerto rumano', '3x10', 1),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'Press inclinado', '4x10', 0);

insert into public.routine_shares (routine_id, shared_by, shared_with_email, shared_with_user_id, status, accepted_at) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'alumno@brabus.test', '33333333-3333-3333-3333-333333333333', 'accepted', now()),
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'invitado@brabus.test', null, 'pending', null);

-- Rutina propia del alumno (sin carpeta) -------------------------------------
insert into public.routines (id, owner_id, folder_id, name) values
  ('b0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', null, 'Cardio y core');
insert into public.routine_days (id, routine_id, name, position) values
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003', 'Core', 0);
insert into public.exercises (id, day_id, name, sets_reps, position) values
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000005', 'Plancha', '3x45s', 0);

-- Dos entrenamientos del alumno en el Día 1 ---------------------------------
insert into public.workout_sessions (id, user_id, routine_id, day_id, started_at, finished_at, status) values
  ('e0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
   'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   now() - interval '7 days', now() - interval '7 days' + interval '1 hour', 'finished'),
  ('e0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333',
   'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'finished');

insert into public.exercise_logs (id, session_id, exercise_id, completed, note) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', true, null),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', true, 'Última serie costó'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', true, null);

insert into public.set_logs (exercise_log_id, set_number, weight, reps) values
  ('f0000000-0000-0000-0000-000000000001', 1, 60, 8),
  ('f0000000-0000-0000-0000-000000000001', 2, 60, 8),
  ('f0000000-0000-0000-0000-000000000001', 3, 60, 7),
  ('f0000000-0000-0000-0000-000000000002', 1, 62.5, 8),
  ('f0000000-0000-0000-0000-000000000002', 2, 62.5, 7),
  ('f0000000-0000-0000-0000-000000000002', 3, 62.5, 6),
  ('f0000000-0000-0000-0000-000000000003', 1, 35, 8),
  ('f0000000-0000-0000-0000-000000000003', 2, 35, 8);
