-- ============================================================================
-- Brabus Fit — Funciones RPC para crear/editar rutinas completas (atómico)
-- ============================================================================

-- Crear rutina con sus días y ejercicios en una sola transacción ---------------
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

-- Editar rutina completa con diff por id (preserva ids no modificados, así no
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

  -- Borra los días que ya no están en el payload.
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

    -- Borra los ejercicios de este día que ya no están.
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
