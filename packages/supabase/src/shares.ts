import {
  fail,
  ok,
  type ActionResult,
  type ShareEmailStatus,
  type ShareUsernameStatus,
} from "@brabus/shared";

import type { BrabusClient } from "./client";

/**
 * Valida en vivo el email a compartir. Null si la RPC falla: degradación
 * elegante, sin bloquear ni mostrar error.
 */
export async function checkShareEmail(
  client: BrabusClient,
  routineId: string,
  email: string,
): Promise<ShareEmailStatus | null> {
  const { data, error } = await client.rpc("validate_share_email", {
    p_routine_id: routineId,
    p_email: email,
  });
  if (error) return null;
  return data as ShareEmailStatus;
}

/** Valida en vivo el username a compartir. */
export async function checkShareUsername(
  client: BrabusClient,
  routineId: string,
  username: string,
): Promise<ShareUsernameStatus | null> {
  const { data, error } = await client.rpc("validate_share_username", {
    p_routine_id: routineId,
    p_username: username,
  });
  if (error) return null;
  return data as ShareUsernameStatus;
}

export type ShareResult = {
  existed: boolean;
  email: string;
  routineName: string;
};

/**
 * Comparte una rutina por email o username. Las validaciones (dueño, coach,
 * uno mismo) las hace la base. El envío de emails queda a cargo de cada app.
 */
export async function shareRoutine(
  client: BrabusClient,
  routineId: string,
  target: { mode: "email" | "username"; value: string },
): Promise<ActionResult<ShareResult>> {
  const { data: routine } = await client
    .from("routines")
    .select("name")
    .eq("id", routineId)
    .maybeSingle();
  if (!routine) return fail("No se encontró la rutina.");

  const { data, error } =
    target.mode === "email"
      ? await client.rpc("share_routine", {
          p_routine_id: routineId,
          p_email: target.value,
        })
      : await client.rpc("share_routine_by_username", {
          p_routine_id: routineId,
          p_username: target.value,
        });
  if (error) return fail(error.message);

  const result = data as { existed: boolean; email: string };
  return ok({ ...result, routineName: routine.name });
}

export type ShareRow = {
  id: string;
  shared_with_email: string;
  status: "pending" | "accepted";
  student: { first_name: string; last_name: string } | null;
};

/** Con quién está compartida una rutina (solo lo ve el dueño, por RLS). */
export async function getRoutineShares(
  client: BrabusClient,
  routineId: string,
): Promise<ShareRow[]> {
  const { data } = await client
    .from("routine_shares")
    .select(
      "id, shared_with_email, status, student:profiles!routine_shares_shared_with_user_id_fkey(first_name, last_name)",
    )
    .eq("routine_id", routineId)
    .order("created_at");
  return (data ?? []) as unknown as ShareRow[];
}

/** Nombre visible de un destinatario (nombre del alumno o su email si está pendiente). */
export function shareDisplayName(share: ShareRow): string {
  return share.student
    ? `${share.student.first_name} ${share.student.last_name}`.trim()
    : share.shared_with_email;
}

export async function unshareRoutine(
  client: BrabusClient,
  shareId: string,
): Promise<ActionResult> {
  const { error } = await client
    .from("routine_shares")
    .delete()
    .eq("id", shareId);
  if (error) return fail(error.message);
  return ok(undefined);
}
