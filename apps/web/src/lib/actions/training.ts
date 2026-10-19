"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult, ExerciseLogInput } from "@brabus/shared";
import * as db from "@brabus/supabase";

import { createClient } from "@/lib/supabase/server";

/**
 * Guarda una sesión completa de una sola vez, al tocar "Guardar sesión".
 * Mientras el usuario entrena nada se persiste.
 */
export async function saveWorkout(
  routineId: string,
  dayId: string,
  logs: ExerciseLogInput[],
): Promise<ActionResult> {
  const result = await db.saveWorkout(await createClient(), routineId, dayId, logs);
  if (result.ok) {
    revalidatePath(`/rutinas/${routineId}/dia/${dayId}`);
    revalidatePath(`/rutinas/${routineId}/historial`);
    revalidatePath("/progreso");
  }
  return result;
}
