-- ============================================================================
-- Brabus Fit — Editar sesiones de entrenamiento ya guardadas
-- ============================================================================
-- Reemplaza de una sola vez (transacción) las series y el detalle de cada
-- ejercicio de una sesión finalizada. Solo el que entrenó puede hacerlo.
--
-- p_logs: [{ "log_id": uuid, "note": text|null,
--            "sets": [{ "weight": number|null, "reps": int|null }, ...] }, ...]
-- - Los ejercicios de la sesión que NO vienen en p_logs se eliminan.
-- - Un ejercicio que queda sin series y sin detalle se elimina.
-- ============================================================================

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
      update public.exercise_logs set note = v_note where id = v_log_id;
      v_keep := v_keep || v_log_id;
    end if;
  end loop;

  delete from public.exercise_logs
  where session_id = p_session_id and not (id = any(v_keep));
end;
$$;

grant execute on function public.update_session_logs(uuid, jsonb) to authenticated;
