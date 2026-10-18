"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult, RoutinePayload } from "@brabus/shared";
import * as db from "@brabus/supabase";

import { createClient } from "@/lib/supabase/server";

// Capa fina: la lógica vive en @brabus/supabase (compartida con mobile).
// Acá solo se agrega lo propio de Next (revalidar caché).

export type { ActionResult } from "@brabus/shared";

export async function createRoutine(
  payload: RoutinePayload,
): Promise<ActionResult<{ id: string }>> {
  const result = await db.createRoutine(await createClient(), payload);
  if (result.ok) revalidatePath("/rutinas");
  return result;
}

export async function updateRoutine(
  routineId: string,
  payload: RoutinePayload,
): Promise<ActionResult<{ id: string }>> {
  const result = await db.updateRoutine(await createClient(), routineId, payload);
  if (result.ok) {
    revalidatePath("/rutinas");
    revalidatePath(`/rutinas/${routineId}`);
  }
  return result;
}

export async function deleteRoutine(routineId: string): Promise<ActionResult> {
  const result = await db.deleteRoutine(await createClient(), routineId);
  if (result.ok) revalidatePath("/rutinas");
  return result;
}

export async function createFolder(name: string): Promise<ActionResult> {
  const result = await db.createFolder(await createClient(), name);
  if (result.ok) revalidatePath("/rutinas");
  return result;
}

export async function deleteFolder(folderId: string): Promise<ActionResult> {
  const result = await db.deleteFolder(await createClient(), folderId);
  if (result.ok) revalidatePath("/rutinas");
  return result;
}
