import {
  fail,
  ok,
  type ActionResult,
  type ProgressSession,
  type SavedSet,
  type SessionLogUpdate,
} from "@brabus/shared";

import type { BrabusClient } from "./client";

// ---------------------------------------------------------------------------
// Historial de una rutina
// ---------------------------------------------------------------------------

export type SessionSummary = {
  id: string;
  date: string;
  dayName: string;
  exerciseCount: number;
};

type SessionListRow = {
  id: string;
  finished_at: string | null;
  started_at: string;
  day: { name: string } | null;
  exercise_logs: { count: number }[];
};

/** Sesiones finalizadas de un usuario en una rutina, la más reciente primero. */
export async function getRoutineSessions(
  client: BrabusClient,
  params: { routineId: string; userId: string },
): Promise<SessionSummary[]> {
  const { data } = await client
    .from("workout_sessions")
    .select("id, finished_at, started_at, day:routine_days(name), exercise_logs(count)")
    .eq("routine_id", params.routineId)
    .eq("user_id", params.userId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(200);

  return ((data ?? []) as unknown as SessionListRow[]).map((s) => ({
    id: s.id,
    date: s.finished_at ?? s.started_at,
    dayName: s.day?.name ?? "Día",
    exerciseCount: s.exercise_logs[0]?.count ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Detalle de una sesión
// ---------------------------------------------------------------------------

export type SessionLogDetail = {
  id: string;
  exerciseName: string;
  setsReps: string;
  note: string | null;
  sets: SavedSet[];
};

export type SessionDetail = {
  id: string;
  userId: string;
  date: string;
  routineId: string;
  routineName: string;
  dayName: string;
  logs: SessionLogDetail[];
};

type SessionDetailRow = {
  id: string;
  user_id: string;
  routine_id: string;
  finished_at: string | null;
  started_at: string;
  routine: { name: string } | null;
  day: { name: string } | null;
  exercise_logs: {
    id: string;
    note: string | null;
    exercise: { name: string; sets_reps: string; position: number } | null;
    set_logs: SavedSet[];
  }[];
};

/** Sesión con sus ejercicios y series. Null si no existe o no hay acceso (RLS). */
export async function getSessionDetail(
  client: BrabusClient,
  sessionId: string,
): Promise<SessionDetail | null> {
  const { data } = await client
    .from("workout_sessions")
    .select(
      "id, user_id, routine_id, finished_at, started_at, routine:routines(name), day:routine_days(name), exercise_logs(id, note, exercise:exercises(name, sets_reps, position), set_logs(set_number, weight, reps))",
    )
    .eq("id", sessionId)
    .eq("status", "finished")
    .maybeSingle();
  if (!data) return null;
  const s = data as unknown as SessionDetailRow;

  return {
    id: s.id,
    userId: s.user_id,
    date: s.finished_at ?? s.started_at,
    routineId: s.routine_id,
    routineName: s.routine?.name ?? "Rutina",
    dayName: s.day?.name ?? "Día",
    logs: [...s.exercise_logs]
      .sort((a, b) => (a.exercise?.position ?? 0) - (b.exercise?.position ?? 0))
      .map((l) => ({
        id: l.id,
        exerciseName: l.exercise?.name ?? "Ejercicio",
        setsReps: l.exercise?.sets_reps ?? "",
        note: l.note,
        sets: [...l.set_logs].sort((a, b) => a.set_number - b.set_number),
      })),
  };
}

/**
 * Reemplaza series y detalle de los ejercicios de una sesión (todo o nada, vía
 * la función SQL update_session_logs — migración 0007).
 */
export async function updateSession(
  client: BrabusClient,
  sessionId: string,
  logs: SessionLogUpdate[],
): Promise<ActionResult> {
  const { error } = await client.rpc("update_session_logs", {
    p_session_id: sessionId,
    p_logs: logs,
  });
  if (error) {
    if (error.code === "PGRST202" || /update_session_logs/.test(error.message)) {
      return fail("Falta actualizar la base de datos (migración 0007) para poder editar.");
    }
    return fail(error.message);
  }
  return ok(undefined);
}

export async function deleteSession(
  client: BrabusClient,
  sessionId: string,
): Promise<ActionResult> {
  const { error, count } = await client
    .from("workout_sessions")
    .delete({ count: "exact" })
    .eq("id", sessionId);
  if (error) return fail(error.message);
  if (count === 0) return fail("No podés eliminar esta sesión.");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Progreso (datos para los gráficos)
// ---------------------------------------------------------------------------

type ProgressRow = {
  id: string;
  finished_at: string | null;
  started_at: string;
  exercise_logs: {
    exercise: { name: string } | null;
    set_logs: { weight: number | null; reps: number | null }[];
  }[];
};

/**
 * Todas las sesiones finalizadas de un usuario con sus series (para los
 * gráficos). Para un coach, RLS deja ver solo las de sus rutinas.
 */
export async function getProgressSessions(
  client: BrabusClient,
  userId: string,
): Promise<ProgressSession[]> {
  const { data } = await client
    .from("workout_sessions")
    .select(
      "id, finished_at, started_at, exercise_logs(exercise:exercises(name), set_logs(weight, reps))",
    )
    .eq("user_id", userId)
    .eq("status", "finished")
    .order("finished_at", { ascending: true })
    .limit(1000);

  return ((data ?? []) as unknown as ProgressRow[]).map((s) => ({
    id: s.id,
    date: s.finished_at ?? s.started_at,
    entries: s.exercise_logs
      .filter((l) => l.exercise)
      .map((l) => ({ name: l.exercise!.name, sets: l.set_logs })),
  }));
}
