"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendRoutineInviteEmail, sendRoutineSharedEmail } from "@/lib/email";
import type { ActionResult } from "@/lib/actions/routines";

export async function shareRoutine(
  routineId: string,
  email: string,
): Promise<ActionResult<{ existed: boolean }>> {
  const { profile } = await requireProfile();
  if (!profile.is_coach) {
    return { ok: false, error: "Solo los coaches pueden compartir rutinas." };
  }

  const supabase = await createClient();

  // Nombre de la rutina para el email (RLS: el coach es dueño).
  const { data: routine } = await supabase
    .from("routines")
    .select("name")
    .eq("id", routineId)
    .maybeSingle();

  if (!routine) {
    return { ok: false, error: "No se encontró la rutina." };
  }

  const { data, error } = await supabase.rpc("share_routine", {
    p_routine_id: routineId,
    p_email: email,
  });

  if (error) return { ok: false, error: error.message };

  const result = data as { existed: boolean; email: string };
  const coachName = `${profile.first_name} ${profile.last_name}`.trim();

  if (result.existed) {
    await sendRoutineSharedEmail({
      to: result.email,
      coachName,
      routineName: routine.name,
    });
  } else {
    await sendRoutineInviteEmail({
      to: result.email,
      coachName,
      routineName: routine.name,
    });
  }

  revalidatePath(`/rutinas/${routineId}`);
  return { ok: true, data: { existed: result.existed } };
}

export async function unshareRoutine(
  shareId: string,
  routineId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("routine_shares")
    .delete()
    .eq("id", shareId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/rutinas/${routineId}`);
  return { ok: true, data: undefined };
}
