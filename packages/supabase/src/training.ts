import {
  fail,
  ok,
  type ActionResult,
  type ExerciseLogInput,
  type HistoryEntry,
  type SavedSet,
  type TrainingExercise,
} from "@brabus/shared";

import { getUserId, type BrabusClient } from "./client";

type HistorySessionRow = {
  finished_at: string | null;
  started_at: string;
  exercise_logs: { exercise_id: string; note: string | null; set_logs: SavedSet[] }[];
};

/**
 * Datos para entrenar un día: ejercicios + historial de las últimas 3 sesiones
 * finalizadas. Cada sesión nueva arranca de cero (nada se persiste hasta
 * guardar la sesión). Null si el día no existe o no pertenece a la rutina.
 */
export async function getTrainingDay(
  client: BrabusClient,
  params: { userId: string; routineId: string; dayId: string },
): Promise<{
  day: { id: string; name: string };
  exercises: TrainingExercise[];
} | null> {
  const { userId, routineId, dayId } = params;

  const { data: day } = await client
    .from("routine_days")
    .select("id, name, routine_id")
    .eq("id", dayId)
    .maybeSingle();
  if (!day || day.routine_id !== routineId) return null;

  const [{ data: exercisesData }, { data: finishedSessions }] =
    await Promise.all([
      client
        .from("exercises")
        .select("id, name, sets_reps, position")
        .eq("day_id", dayId)
        .order("position"),
      client
        .from("workout_sessions")
        .select(
          "finished_at, started_at, exercise_logs(exercise_id, note, set_logs(set_number, weight, reps))",
        )
        .eq("user_id", userId)
        .eq("day_id", dayId)
        .eq("status", "finished")
        .order("finished_at", { ascending: false })
        .limit(3),
    ]);

  const history = (finishedSessions ?? []) as unknown as HistorySessionRow[];
  const historyByExercise = new Map<string, HistoryEntry[]>();
  for (const session of history) {
    const date = session.finished_at ?? session.started_at;
    for (const log of session.exercise_logs ?? []) {
      const sets = [...(log.set_logs ?? [])].sort(
        (a, b) => a.set_number - b.set_number,
      );
      const note = log.note?.trim() || null;
      if (sets.length === 0 && !note) continue;
      const list = historyByExercise.get(log.exercise_id) ?? [];
      list.push({ date, sets, note });
      historyByExercise.set(log.exercise_id, list);
    }
  }

  return {
    day: { id: day.id, name: day.name },
    exercises: (exercisesData ?? []).map((ex) => ({
      id: ex.id,
      name: ex.name,
      setsReps: ex.sets_reps,
      history: historyByExercise.get(ex.id) ?? [],
    })),
  };
}

/**
 * Guarda una sesión de entrenamiento completa de una sola vez. Si algo falla a
 * mitad de camino, borra la sesión (cascade) para no dejarla a medias. También
 * limpia sesiones "en progreso" viejas de ese día.
 */
export async function saveWorkout(
  client: BrabusClient,
  routineId: string,
  dayId: string,
  logs: ExerciseLogInput[],
): Promise<ActionResult> {
  const userId = await getUserId(client);
  if (!userId) return fail("No autenticado.");

  await client
    .from("workout_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("day_id", dayId)
    .eq("status", "in_progress");

  if (logs.length === 0) return ok(undefined);

  const now = new Date().toISOString();
  const { data: session, error: sessionErr } = await client
    .from("workout_sessions")
    .insert({
      user_id: userId,
      routine_id: routineId,
      day_id: dayId,
      started_at: now,
      finished_at: now,
      status: "finished",
    })
    .select("id")
    .single();
  if (sessionErr) return fail(sessionErr.message);

  const rollback = async (message: string): Promise<ActionResult> => {
    await client.from("workout_sessions").delete().eq("id", session.id);
    return fail(message);
  };

  const { data: exerciseLogs, error: logsErr } = await client
    .from("exercise_logs")
    .insert(
      logs.map((l) => ({
        session_id: session.id,
        exercise_id: l.exerciseId,
        completed: true,
        note: l.note && l.note.trim() ? l.note.trim() : null,
      })),
    )
    .select("id, exercise_id");
  if (logsErr) return rollback(logsErr.message);

  const logIdByExercise = new Map(
    exerciseLogs.map((l) => [l.exercise_id, l.id]),
  );

  const setRows = logs.flatMap((l) =>
    l.sets
      .filter((s) => s.weight !== null || s.reps !== null)
      .map((s) => ({
        exercise_log_id: logIdByExercise.get(l.exerciseId)!,
        set_number: s.set_number,
        weight: s.weight,
        reps: s.reps,
      })),
  );

  if (setRows.length > 0) {
    const { error: setsErr } = await client.from("set_logs").insert(setRows);
    if (setsErr) return rollback(setsErr.message);
  }

  return ok(undefined);
}
