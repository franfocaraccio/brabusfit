-- ============================================================================
-- Brabus Fit — Descanso por ejercicio y variante en el registro
-- ============================================================================
-- - exercises.rest_seconds: descanso entre series que fija el coach (null = sin
--   descanso; la app no muestra la cuenta regresiva).
-- - exercise_logs.variant: con qué lo hizo el alumno (Barra, Máquina, Polea,
--   Smith). Es solo un dato del registro; no cambia la rutina.
-- - Crear / editar / copiar rutinas y editar sesiones conservan los datos nuevos.
-- La duración del entrenamiento usa workout_sessions.started_at (ya existía).
-- ============================================================================

alter table public.exercises
  add column if not exists rest_seconds int
    check (rest_seconds is null or rest_seconds between 5 and 3600);

alter table public.exercise_logs
  add column if not exists variant text
    check (variant is null or variant in ('Barra', 'Máquina', 'Polea', 'Smith'));

-- Descanso que manda la app (segundos; vacío o fuera de rango = sin descanso).
create or replace function public._rest_seconds(p_ex jsonb)
returns int language sql immutable set search_path = public as $$
  select case
    when (p_ex->>'rest_seconds') ~ '^[0-9]+$'
     and (p_ex->>'rest_seconds')::int between 5 and 3600
    then (p_ex->>'rest_seconds')::int
  end;
$$;

-- Variante válida o null.
create or replace function public._log_variant(p_variant text)
returns text language sql immutable set search_path = public as $$
  select case when p_variant in ('Barra', 'Máquina', 'Polea', 'Smith') then p_variant end;
$$;

create or replace function public._copy_routine(
  p_src       uuid,
  p_name      text,
  p_folder_id uuid,
  p_client_id uuid,
  p_owner     uuid default null
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

  insert into public.routines (owner_id, folder_id, name, client_id)
    values (v_owner, p_folder_id, coalesce(p_name, v_src.name), p_client_id)
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

      insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, rest_seconds, position)
        values (v_new_day, v_cat, v_ex.variant, v_ex.name, v_ex.sets_reps, v_ex.rest_seconds, v_ex.position)
        returning id into v_new_ex;
      v_exs := v_exs || jsonb_build_object(v_ex.id::text, v_new_ex);
    end loop;
  end loop;

  return jsonb_build_object('id', v_new, 'days', v_days, 'exercises', v_exs);
end; $$;

revoke all on function public._copy_routine(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.create_full_routine(
  p_name      text,
  p_folder_id uuid,
  p_days      jsonb,
  p_link_id   uuid default null
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

  if p_link_id is not null and not exists (
    select 1 from public.coach_students where id = p_link_id and coach_id = auth.uid()
  ) then
    raise exception 'Ese cliente no es tuyo.';
  end if;

  insert into public.routines (owner_id, folder_id, name, client_id)
    values (
      auth.uid(),
      case when p_link_id is null then p_folder_id end,
      coalesce(p_name, ''),
      p_link_id
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
      insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, rest_seconds, position)
        values (
          v_day_id,
          nullif(v_ex->>'catalog_id', '')::uuid,
          v_ex->>'variant',
          coalesce(v_ex->>'name', ''),
          coalesce(v_ex->>'sets_reps', ''),
          public._rest_seconds(v_ex),
          v_ex_pos
        );
      v_ex_pos := v_ex_pos + 1;
    end loop;
  end loop;

  return v_routine_id;
end; $$;

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
        if v_ex ? 'catalog_id' then
          -- App nueva: elige del catálogo (el trigger arma el nombre).
          update public.exercises
             set catalog_id = (v_ex->>'catalog_id')::uuid,
                 variant = v_ex->>'variant',
                 sets_reps = coalesce(v_ex->>'sets_reps', ''),
                 rest_seconds = public._rest_seconds(v_ex),
                 position = v_ex_pos
           where id = (v_ex->>'id')::uuid and day_id = v_day_id;
        else
          -- App vieja: solo nombre (el trigger lo busca en el catálogo).
          update public.exercises
             set name = coalesce(v_ex->>'name', ''),
                 sets_reps = coalesce(v_ex->>'sets_reps', ''),
                 position = v_ex_pos
           where id = (v_ex->>'id')::uuid and day_id = v_day_id;
        end if;
      else
        insert into public.exercises (day_id, catalog_id, variant, name, sets_reps, rest_seconds, position)
          values (
            v_day_id,
            nullif(v_ex->>'catalog_id', '')::uuid,
            v_ex->>'variant',
            coalesce(v_ex->>'name', ''),
            coalesce(v_ex->>'sets_reps', ''),
            public._rest_seconds(v_ex),
            v_ex_pos
          );
      end if;
      v_ex_pos := v_ex_pos + 1;
    end loop;
  end loop;

  return p_routine_id;
end; $$;

create or replace function public.update_session_logs(
  p_session_id uuid,
  p_logs jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_log jsonb;
  v_log_id uuid;
  v_note text;
  v_set jsonb;
  v_n int;
  v_keep uuid[] := '{}';
begin
  if not exists (
    select 1 from public.workout_sessions
    where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'No podés editar esta sesión.';
  end if;

  for v_log in select * from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb)) loop
    v_log_id := (v_log->>'log_id')::uuid;
    if not exists (
      select 1 from public.exercise_logs
      where id = v_log_id and session_id = p_session_id
    ) then
      raise exception 'El ejercicio no pertenece a la sesión.';
    end if;

    v_note := nullif(left(btrim(coalesce(v_log->>'note', '')), 80), '');

    delete from public.set_logs where exercise_log_id = v_log_id;

    v_n := 0;
    for v_set in select * from jsonb_array_elements(coalesce(v_log->'sets', '[]'::jsonb)) loop
      if (v_set->>'weight') is null and (v_set->>'reps') is null then
        continue;
      end if;
      v_n := v_n + 1;
      insert into public.set_logs (exercise_log_id, set_number, weight, reps)
      values (v_log_id, v_n, (v_set->>'weight')::numeric, (v_set->>'reps')::int);
    end loop;

    if v_n = 0 and v_note is null then
      delete from public.exercise_logs where id = v_log_id;
    else
      update public.exercise_logs
         set note = v_note,
             -- La variante se conserva si la app no la manda.
             variant = case when v_log ? 'variant' then public._log_variant(v_log->>'variant') else variant end
       where id = v_log_id;
      v_keep := v_keep || v_log_id;
    end if;
  end loop;

  delete from public.exercise_logs
  where session_id = p_session_id and not (id = any(v_keep));
end;
$$;

grant execute on function public.update_session_logs(uuid, jsonb) to authenticated;
