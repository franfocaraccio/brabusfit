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
