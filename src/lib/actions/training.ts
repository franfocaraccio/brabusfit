"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/routines";

export type SetInput = { set_number: number; weight: number | null; reps: number | null };

export type ExerciseLogInput = {
  exerciseId: string;
  sets: SetInput[];
  note: string | null;
};

/**
 * Guarda una sesión de entrenamiento completa de una sola vez, al cerrar la
 * rutina. Mientras el usuario entrena nada se persiste: si sale sin cerrar,
 * la sesión se pierde y al volver arranca de cero.
 */
export async function saveWorkout(
  routineId: string,
  dayId: string,
  logs: ExerciseLogInput[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Limpia sesiones "en progreso" que hayan quedado de la lógica anterior.
  await supabase
    .from("workout_sessions")
    .delete()
    .eq("user_id", user.id)
    .eq("day_id", dayId)
    .eq("status", "in_progress");

  if (logs.length === 0) return { ok: true, data: undefined };

  const now = new Date().toISOString();
  const { data: session, error: sessionErr } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      routine_id: routineId,
      day_id: dayId,
      started_at: now,
      finished_at: now,
      status: "finished",
    })
    .select("id")
    .single();

  if (sessionErr) return { ok: false, error: sessionErr.message };

  // Si algo falla después, borramos la sesión (cascade) para no dejarla a medias.
  const rollback = async (message: string): Promise<ActionResult> => {
    await supabase.from("workout_sessions").delete().eq("id", session.id);
    return { ok: false, error: message };
  };

  const { data: exerciseLogs, error: logsErr } = await supabase
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
    const { error: setsErr } = await supabase.from("set_logs").insert(setRows);
    if (setsErr) return rollback(setsErr.message);
  }

  revalidatePath(`/rutinas/${routineId}/dia/${dayId}`);
  return { ok: true, data: undefined };
}
