import {
  fail,
  ok,
  parseDecimal,
  usernameError,
  type ActionResult,
  type Profile,
} from "@brabus/shared";

import { getUserId, type BrabusClient } from "./client";

export async function getProfile(
  client: BrabusClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

/**
 * ¿Está disponible el username? Optimista ante error de RPC; la unicidad se
 * garantiza igual a nivel DB (índice único).
 */
export async function isUsernameAvailable(
  client: BrabusClient,
  username: string,
): Promise<boolean> {
  if (usernameError(username)) return false;
  const { data, error } = await client.rpc("username_available", {
    p_username: username,
  });
  if (error) return true;
  return data as boolean;
}

export type EditableProfile = {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  heightCm: string;
  weightKg: string;
};

/**
 * Actualiza los datos editables del perfil (nombre, apellido, nacimiento,
 * altura, peso). NO toca email, rol (is_coach) ni onboarded.
 */
export async function updateProfile(
  client: BrabusClient,
  input: EditableProfile,
): Promise<ActionResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) return fail("Completá nombre y apellido.");

  const userId = await getUserId(client);
  if (!userId) return fail("No autenticado.");

  const { error } = await client
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      birth_date: input.birthDate || null,
      height_cm: parseDecimal(input.heightCm),
      weight_kg: parseDecimal(input.weightKg),
    })
    .eq("id", userId);

  if (error) return fail(error.message);
  return ok(undefined);
}

export type CompleteProfileInput = EditableProfile & {
  username: string;
  isCoach: boolean;
};

/** Onboarding (usuarios de SSO): datos personales + username + rol. */
export async function completeProfile(
  client: BrabusClient,
  input: CompleteProfileInput,
): Promise<ActionResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const username = input.username.trim().toLowerCase();
  if (!firstName || !lastName) return fail("Completá nombre y apellido.");
  const uErr = usernameError(username);
  if (uErr) return fail(`Nombre de usuario: ${uErr}`);

  const userId = await getUserId(client);
  if (!userId) return fail("No autenticado.");

  const { error } = await client
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      birth_date: input.birthDate || null,
      height_cm: parseDecimal(input.heightCm),
      weight_kg: parseDecimal(input.weightKg),
      username,
      is_coach: input.isCoach,
      onboarded: true,
    })
    .eq("id", userId);

  if (error) {
    if (error.code === "23505") return fail("Ese nombre de usuario ya está en uso.");
    return fail(error.message);
  }
  return ok(undefined);
}
