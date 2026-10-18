"use server";

import { revalidatePath } from "next/cache";

import type {
  ActionResult,
  ShareEmailStatus,
  ShareUsernameStatus,
} from "@brabus/shared";
import * as db from "@brabus/supabase";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendRoutineInviteEmail, sendRoutineSharedEmail } from "@/lib/email";

/** Valida en vivo el email a compartir (null si la RPC falla). */
export async function checkShareEmail(
  routineId: string,
  email: string,
): Promise<ShareEmailStatus | null> {
  return db.checkShareEmail(await createClient(), routineId, email);
}

/** Valida en vivo el username a compartir. */
export async function checkShareUsername(
  routineId: string,
  username: string,
): Promise<ShareUsernameStatus | null> {
  return db.checkShareUsername(await createClient(), routineId, username);
}

/**
 * Comparte y envía el email correspondiente (aviso si ya tenía cuenta,
 * invitación si no). El envío de emails es propio de la web (server-side).
 */
async function shareAndNotify(
  routineId: string,
  target: { mode: "email" | "username"; value: string },
): Promise<ActionResult<{ existed: boolean }>> {
  const { profile } = await requireProfile();
  if (!profile.is_coach) {
    return { ok: false, error: "Solo los coaches pueden compartir rutinas." };
  }

  const result = await db.shareRoutine(await createClient(), routineId, target);
  if (!result.ok) return result;

  const { existed, email, routineName } = result.data;
  const coachName = `${profile.first_name} ${profile.last_name}`.trim();
  if (existed) {
    await sendRoutineSharedEmail({ to: email, coachName, routineName });
  } else {
    await sendRoutineInviteEmail({ to: email, coachName, routineName });
  }

  revalidatePath(`/rutinas/${routineId}`);
  return { ok: true, data: { existed } };
}

export async function shareRoutine(routineId: string, email: string) {
  return shareAndNotify(routineId, { mode: "email", value: email });
}

export async function shareRoutineByUsername(routineId: string, username: string) {
  return shareAndNotify(routineId, { mode: "username", value: username });
}

export async function unshareRoutine(
  shareId: string,
  routineId: string,
): Promise<ActionResult> {
  const result = await db.unshareRoutine(await createClient(), shareId);
  if (result.ok) revalidatePath(`/rutinas/${routineId}`);
  return result;
}
