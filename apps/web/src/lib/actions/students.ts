"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult, AddStudentStatus } from "@brabus/shared";
import * as db from "@brabus/supabase";

import { requireProfile } from "@/lib/auth";
import { sendCoachInviteEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

/** Validación en vivo al escribir el usuario/email del alumno. */
export async function checkAddStudent(
  mode: "email" | "username",
  value: string,
): Promise<AddStudentStatus | null> {
  return db.checkAddStudent(await createClient(), mode, value);
}

/** Agrega un alumno (invitación pendiente). Si no tiene cuenta, le avisa por email. */
export async function addStudent(
  mode: "email" | "username",
  value: string,
): Promise<ActionResult<{ existed: boolean }>> {
  const { profile } = await requireProfile();
  const result = await db.addStudent(await createClient(), mode, value);
  if (!result.ok) return result;

  if (!result.data.existed) {
    const coachName = `${profile.first_name} ${profile.last_name}`.trim();
    await sendCoachInviteEmail({ to: result.data.email, coachName });
  }
  revalidatePath("/alumnos");
  return { ok: true, data: { existed: result.data.existed } };
}

export async function unlinkStudent(linkId: string): Promise<ActionResult> {
  const result = await db.unlinkStudent(await createClient(), linkId);
  if (result.ok) {
    revalidatePath("/alumnos", "layout");
    revalidatePath("/rutinas");
  }
  return result;
}

/** Alumno: aceptar / rechazar una invitación de un coach. */
export async function respondInvitation(
  linkId: string,
  accept: boolean,
): Promise<ActionResult> {
  const result = await db.respondInvitation(await createClient(), linkId, accept);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Alumno: desvincularse de un coach (deja de ver lo que le armó). */
export async function leaveCoach(linkId: string): Promise<ActionResult> {
  const result = await db.leaveCoach(await createClient(), linkId);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
