"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/routines";

export type SetInput = { set_number: number; weight: number | null; reps: number | null };

/** Devuelve la sesión in_progress de este día para el usuario, o crea una nueva. */
export async function startSession(
  routineId: string,
  dayId: string,
): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("day_id", dayId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { ok: true, data: { sessionId: existing.id } };

  const { data: created, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: user.id, routine_id: routineId, day_id: dayId })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { sessionId: created.id } };
}

/** Guarda (o actualiza) el registro de un ejercicio y lo marca como completado. */
export async function saveExerciseLog(
  sessionId: string,
  exerciseId: string,
  sets: SetInput[],
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: log, error: upsertErr } = await supabase
    .from("exercise_logs")
    .upsert(
      { session_id: sessionId, exercise_id: exerciseId, completed: true },
      { onConflict: "session_id,exercise_id" },
    )
    .select("id")
    .single();

  if (upsertErr) return { ok: false, error: upsertErr.message };

  // Reemplaza los sets anteriores por los nuevos.
  await supabase.from("set_logs").delete().eq("exercise_log_id", log.id);

  const rows = sets
    .filter((s) => s.weight !== null || s.reps !== null)
    .map((s) => ({
      exercise_log_id: log.id,
      set_number: s.set_number,
      weight: s.weight,
      reps: s.reps,
    }));

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("set_logs").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  return { ok: true, data: undefined };
}

/** Cierra la sesión (la marca como finalizada). */
export async function finishSession(
  sessionId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workout_sessions")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
