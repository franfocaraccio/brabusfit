"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult, ClientInput, InviteStatus } from "@brabus/shared";
import * as db from "@brabus/supabase";

import { requireProfile } from "@/lib/auth";
import { sendCoachInviteEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

const revalidateClients = () => {
  revalidatePath("/clientes", "layout");
  revalidatePath("/rutinas");
};

/** Crea (id null) o actualiza la ficha de un cliente. */
export async function saveClient(
  clientId: string | null,
  input: ClientInput,
): Promise<ActionResult<{ id: string }>> {
  const result = await db.saveClient(await createClient(), clientId, input);
  if (result.ok) revalidateClients();
  return result;
}

/** Validación en vivo al invitar a la app. */
export async function checkInviteClient(
  clientId: string,
  mode: "email" | "username",
  value: string,
): Promise<InviteStatus | null> {
  return db.checkInviteClient(await createClient(), clientId, mode, value);
}

/** Invita la ficha a la app. Si no tiene cuenta, le avisa por email. */
export async function inviteClient(
  clientId: string,
  mode: "email" | "username",
  value: string,
): Promise<ActionResult<{ existed: boolean }>> {
  const { profile } = await requireProfile();
  const result = await db.inviteClient(await createClient(), clientId, mode, value);
  if (!result.ok) return result;

  if (!result.data.existed) {
    const coachName = `${profile.first_name} ${profile.last_name}`.trim();
    await sendCoachInviteEmail({ to: result.data.email, coachName });
  }
  revalidateClients();
  return { ok: true, data: { existed: result.data.existed } };
}

export async function removeClientAccess(clientId: string): Promise<ActionResult> {
  const result = await db.removeClientAccess(await createClient(), clientId);
  if (result.ok) revalidateClients();
  return result;
}

export async function setClientArchived(
  clientId: string,
  archived: boolean,
): Promise<ActionResult> {
  const result = await db.setClientArchived(await createClient(), clientId, archived);
  if (result.ok) revalidateClients();
  return result;
}

export async function deleteClient(clientId: string): Promise<ActionResult> {
  const result = await db.deleteClient(await createClient(), clientId);
  if (result.ok) revalidateClients();
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

/** Alumno: desvincularse de un coach (se queda con una copia de sus rutinas). */
export async function leaveCoach(linkId: string): Promise<ActionResult> {
  const result = await db.leaveCoach(await createClient(), linkId);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
