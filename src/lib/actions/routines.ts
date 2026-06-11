"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { RoutineDayInput } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type RoutinePayload = {
  name: string;
  folderId: string | null;
  days: RoutineDayInput[];
};

function validateRoutine(payload: RoutinePayload): string | null {
  if (!payload.name.trim()) return "La rutina necesita un nombre.";
  if (payload.days.length === 0) return "Agregá al menos un día.";
  for (const day of payload.days) {
    if (!day.name.trim()) return "Cada día necesita un nombre.";
    for (const ex of day.exercises) {
      if (!ex.name.trim() || !ex.sets_reps.trim()) {
        return "Cada ejercicio necesita nombre y series/repeticiones.";
      }
    }
  }
  return null;
}

export async function createRoutine(
  payload: RoutinePayload,
): Promise<ActionResult<{ id: string }>> {
  const error = validateRoutine(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("create_full_routine", {
    p_name: payload.name.trim(),
    p_folder_id: payload.folderId,
    p_days: payload.days,
  });

  if (rpcError) return { ok: false, error: rpcError.message };

  revalidatePath("/rutinas");
  return { ok: true, data: { id: data as string } };
}

export async function updateRoutine(
  routineId: string,
  payload: RoutinePayload,
): Promise<ActionResult<{ id: string }>> {
  const error = validateRoutine(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("update_full_routine", {
    p_routine_id: routineId,
    p_name: payload.name.trim(),
    p_folder_id: payload.folderId,
    p_days: payload.days,
  });

  if (rpcError) return { ok: false, error: rpcError.message };

  revalidatePath("/rutinas");
  revalidatePath(`/rutinas/${routineId}`);
  return { ok: true, data: { id: data as string } };
}

export async function deleteRoutine(
  routineId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("routines")
    .delete()
    .eq("id", routineId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/rutinas");
  return { ok: true, data: undefined };
}

export async function createFolder(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "La carpeta necesita un nombre." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { error } = await supabase
    .from("folders")
    .insert({ owner_id: user.id, name: trimmed });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/rutinas");
  return { ok: true, data: undefined };
}

export async function deleteFolder(folderId: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Las rutinas dentro de la carpeta pasan a la raíz (folder_id = null por FK).
  const { error } = await supabase.from("folders").delete().eq("id", folderId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/rutinas");
  return { ok: true, data: undefined };
}
