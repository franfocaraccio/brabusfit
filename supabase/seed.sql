-- ============================================================================
-- Datos de prueba SOLO para el Supabase local (`npx supabase start` / `db reset`).
-- Nunca correr en producción.
--
-- Usuarios (contraseña de todos: brabus-test-123):
--   coach@brabus.test    coach_test   coach
--   coach2@brabus.test   coach_dos    coach (para probar "no se comparte a coaches")
--   alumno@brabus.test   alumno_test  alumno de coach_test (activo) con su rutina asignada
--                                     + ~6 meses de entrenamientos
--   alumno2@brabus.test  alumno_dos   alumno sin rutinas
--
-- Clientes de coach_test: Andrés (con app), invitado@ (invitación pendiente,
-- sin cuenta) y Roberto (sin app: solo ficha + rutina para exportar).
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

-- Fichas de clientes del coach ------------------------------------------------
insert into public.coach_students (
  id, coach_id, student_id, student_email, status, accepted_at,
  first_name, last_name, phone, birth_date, sex, height_cm, initial_weight_kg, goal, level, injuries, notes
) values
  ('f1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', 'alumno@brabus.test', 'active', now(),
   'Andrés', 'Alumno', '+54 9 11 5555-0001', '1998-02-20', 'masculino', 180, 78.5,
   'ganar_masa', 'intermedio', null, 'Entrena a la tarde. Quiere llegar a 85 kg.'),
  ('f1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   null, 'invitado@brabus.test', 'pending', null,
   'Valeria', 'Invitada', null, null, 'femenino', null, null, 'tonificar', 'principiante', null, null),
  ('f1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   null, null, 'none', null,
   'Roberto', 'Sin App', '+54 9 11 5555-0003', '1958-07-03', 'masculino', 172, 91,
   'salud', 'principiante', 'Prótesis de rodilla derecha', 'No usa celular: imprimirle la rutina.');

-- Rutinas del coach: la de Andrés (asignada) y una plantilla en carpeta -------
insert into public.folders (id, owner_id, name) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Fuerza'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Hipertrofia');

insert into public.routines (id, owner_id, folder_id, name, client_id) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   null, 'Fuerza 3 días', 'f1000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000000002', 'Torso / Pierna', null);

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

-- Plantilla "Fuerza 3 días" (copia en la carpeta Fuerza) y copias asignadas a
-- Valeria (la ve cuando se registre y acepte) y a Roberto (sin app).
select public._copy_routine('b0000000-0000-0000-0000-000000000001', null,
  'a0000000-0000-0000-0000-000000000001', null);
select public._copy_routine('b0000000-0000-0000-0000-000000000002', null,
  null, 'f1000000-0000-0000-0000-000000000002');
select public._copy_routine('b0000000-0000-0000-0000-000000000002', 'Movilidad y fuerza',
  null, 'f1000000-0000-0000-0000-000000000003');

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

-- ============================================================================
-- ~6 meses de entrenamientos de alumno@brabus.test (para ver los gráficos de
-- Progreso con datos): lunes Día 1, miércoles Día 2, viernes Día 3, con
-- algunas faltas y progresión de cargas.
-- ============================================================================
do $$
declare
  v_user    uuid := '33333333-3333-3333-3333-333333333333';
  v_routine uuid := 'b0000000-0000-0000-0000-000000000001';
  v_day     date;
  v_week    int;
  v_dow     int;
  v_day_id  uuid;
  v_session uuid;
  v_log     uuid;
  v_ex      record;
  v_w       numeric;
  v_reps    int;
  v_sets    int;
  v_t       numeric;
begin
  perform setseed(0.42);  -- mismos datos en cada reset
  for v_day in select d::date from generate_series(current_date - 180, current_date - 4, interval '1 day') d loop
    v_dow  := extract(isodow from v_day);
    v_week := (v_day - (current_date - 180)) / 7;
    v_day_id := case v_dow
      when 1 then 'c0000000-0000-0000-0000-000000000001'::uuid
      when 3 then 'c0000000-0000-0000-0000-000000000002'::uuid
      when 5 then 'c0000000-0000-0000-0000-000000000003'::uuid
      else null end;
    continue when v_day_id is null;
    continue when v_week in (9, 10) or random() < 0.15;

    v_t := v_week / 25.0;
    insert into public.workout_sessions (user_id, routine_id, day_id, started_at, finished_at, status)
      values (v_user, v_routine, v_day_id, v_day + time '18:30', v_day + time '19:35', 'finished')
      returning id into v_session;

    for v_ex in
      select e.id, e.position, e.name from public.exercises e where e.day_id = v_day_id order by e.position
    loop
      insert into public.exercise_logs (session_id, exercise_id, completed, note)
        values (v_session, v_ex.id, true,
                case when random() < 0.08 then (array['Última serie costó', 'Buena técnica', 'Hecho en Smith', 'Subir peso la próxima'])[1 + floor(random() * 4)::int] end)
        returning id into v_log;

      v_sets := case when v_ex.position = 0 then 4 else 3 end;
      for s in 1..v_sets loop
        v_w := case v_ex.name
          when 'Press banca'        then 50 + 20 * v_t
          when 'Press militar'      then 30 + 12.5 * v_t
          when 'Remo con barra'     then 50 + 22.5 * v_t
          when 'Sentadilla'         then 70 + 40 * v_t
          when 'Peso muerto rumano' then 60 + 35 * v_t
          else null end;
        if v_w is not null then
          v_w := round((v_w + (random() - 0.5) * 4) / 2.5) * 2.5;
          v_reps := greatest(4, 10 - s + floor(random() * 3)::int);
        else
          v_reps := greatest(3, round(6 + 7 * v_t + (random() - 0.5) * 3 - (s - 1))::int);
        end if;
        insert into public.set_logs (exercise_log_id, set_number, weight, reps) values (v_log, s, v_w, v_reps);
      end loop;
    end loop;
  end loop;
end $$;

-- ============================================================================
-- Nutrición: plantilla "Volumen 2800" (carpeta Volumen), copia vigente para
-- Andrés y un plan simple para Roberto (sin app).
-- ============================================================================
do $$
declare
  v_coach  uuid := '11111111-1111-1111-1111-111111111111';
  v_folder uuid;
  v_plan   uuid;
  v_meal   uuid;
  v_opt    uuid;
begin
  insert into public.nutrition_folders (owner_id, name) values (v_coach, 'Volumen')
    returning id into v_folder;

  insert into public.nutrition_plans (
    id, owner_id, folder_id, name, guidelines, target_kcal, target_protein, target_carbs, target_fat, target_water_l
  ) values (
    '90000000-0000-0000-0000-000000000001', v_coach, v_folder, 'Volumen 2800',
    E'Tomar 3 L de agua por día.\nCreatina 5 g diarios.\nEvitar ultraprocesados.',
    2800, 205, 320, 80, 3
  ) returning id into v_plan;

  -- Desayuno con dos opciones (~660 kcal cada una)
  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Desayuno', '8:00', 0) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Avena', '100', 'g', 375, 13, 66, 7, 0),
    (v_opt, 'Leche descremada', '250', 'ml', 90, 9, 12, 0, 1),
    (v_opt, 'Banana', '1', 'unidad', 105, 1, 27, 0, 2),
    (v_opt, 'Mantequilla de maní', '1', 'cda', 95, 4, 3, 8, 3);
  insert into public.nutrition_options (meal_id, position) values (v_meal, 1) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Pan integral', '3', 'rebanada', 240, 12, 42, 3, 0),
    (v_opt, 'Huevos', '3', 'unidades', 225, 19, 1, 15, 1),
    (v_opt, 'Palta', '50', 'g', 80, 1, 4, 7, 2),
    (v_opt, 'Jugo de naranja', '250', 'ml', 110, 2, 26, 0, 3);

  -- Almuerzo (~840 kcal)
  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Almuerzo', '13:00', 1) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Pechuga de pollo', '200', 'g', 330, 62, 0, 7, 0),
    (v_opt, 'Arroz blanco (cocido)', '300', 'g', 390, 8, 84, 1, 1),
    (v_opt, 'Ensalada mixta', null, 'a gusto', null, null, null, null, 2),
    (v_opt, 'Aceite de oliva', '1', 'cda', 120, 0, 0, 14, 3);

  -- Merienda (~450 kcal)
  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Merienda', '17:00', 2) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Yogur griego', '200', 'g', 190, 18, 8, 10, 0),
    (v_opt, 'Granola', '50', 'g', 225, 5, 32, 9, 1),
    (v_opt, 'Frutillas', '100', 'g', 32, 1, 8, 0, 2);

  -- Post-entreno (~225 kcal)
  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Post-entreno', '19:30', 3) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Proteína whey', '30', 'g', 120, 24, 3, 2, 0),
    (v_opt, 'Banana', '1', 'unidad', 105, 1, 27, 0, 1);

  -- Cena (~610 kcal)
  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Cena', '21:30', 4) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Carne magra', '200', 'g', 350, 52, 0, 15, 0),
    (v_opt, 'Papa (hervida)', '300', 'g', 260, 6, 60, 0, 1),
    (v_opt, 'Vegetales asados', null, 'a gusto', null, null, null, null, 2);

  -- Copias para clientes.
  v_plan := public._copy_plan('90000000-0000-0000-0000-000000000001', null, null,
    'f1000000-0000-0000-0000-000000000001');
  update public.nutrition_plans set is_current = true where id = v_plan;

  insert into public.nutrition_plans (owner_id, client_id, name, guidelines, target_kcal, is_current)
    values (v_coach, 'f1000000-0000-0000-0000-000000000003', 'Plan saludable', 'Comer despacio. Caminar 30 min después de cenar.', 1900, true)
    returning id into v_plan;
  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Desayuno', '8:30', 0) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Té con leche', '1', 'taza', 60, 3, 6, 2, 0),
    (v_opt, 'Tostadas integrales', '2', 'unidades', 140, 6, 26, 2, 1),
    (v_opt, 'Queso blanco', '2', 'cda', 60, 6, 2, 3, 2),
    (v_opt, 'Huevo', '1', 'unidad', 75, 6, 0, 5, 3);

  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Media mañana', '11:00', 1) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Manzana', '1', 'unidad', 80, 0, 21, 0, 0),
    (v_opt, 'Almendras', '15', 'g', 90, 3, 3, 8, 1);

  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Almuerzo', '13:30', 2) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Merluza', '200', 'g', 180, 36, 0, 3, 0),
    (v_opt, 'Arroz integral (cocido)', '200', 'g', 220, 5, 46, 1, 1),
    (v_opt, 'Puré de calabaza', '250', 'g', 100, 2, 22, 1, 2),
    (v_opt, 'Aceite de oliva', '1', 'cdita', 40, 0, 0, 5, 3);

  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Merienda', '17:30', 3) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Yogur descremado', '200', 'g', 90, 8, 12, 0, 0),
    (v_opt, 'Avena', '30', 'g', 115, 4, 20, 2, 1),
    (v_opt, 'Nueces', '15', 'g', 100, 2, 2, 10, 2);

  insert into public.nutrition_meals (plan_id, name, time_label, position)
    values (v_plan, 'Cena', '21:00', 4) returning id into v_meal;
  insert into public.nutrition_options (meal_id, position) values (v_meal, 0) returning id into v_opt;
  insert into public.nutrition_items (option_id, food, amount, unit, kcal, protein, carbs, fat, position) values
    (v_opt, 'Pollo (pechuga)', '150', 'g', 250, 46, 0, 5, 0),
    (v_opt, 'Verduras salteadas', '200', 'g', 70, 3, 12, 1, 1),
    (v_opt, 'Aceite de oliva', '1', 'cda', 120, 0, 0, 14, 2),
    (v_opt, 'Pan integral', '1', 'rebanada', 80, 4, 14, 1, 3);
end $$;
