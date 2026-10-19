"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult, SessionLogUpdate } from "@brabus/shared";
import * as db from "@brabus/supabase";

import { createClient } from "@/lib/supabase/server";

/** Guarda los cambios de una sesión pasada (series y detalle). */
export async function updateSession(
  sessionId: string,
  routineId: string,
  logs: SessionLogUpdate[],
): Promise<ActionResult> {
  const result = await db.updateSession(await createClient(), sessionId, logs);
  if (result.ok) revalidateSession(sessionId, routineId);
  return result;
}

export async function deleteSession(
  sessionId: string,
  routineId: string,
): Promise<ActionResult> {
  const result = await db.deleteSession(await createClient(), sessionId);
  if (result.ok) revalidateSession(sessionId, routineId);
  return result;
}

function revalidateSession(sessionId: string, routineId: string) {
  revalidatePath(`/sesiones/${sessionId}`);
  revalidatePath(`/rutinas/${routineId}/historial`);
  // El historial que se muestra al entrenar cada día también cambia.
  revalidatePath("/rutinas/[id]/dia/[dayId]", "page");
  revalidatePath("/progreso");
}
