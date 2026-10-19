import { fail, ok, parseDecimal, usernameError, type ActionResult } from "@brabus/shared";

import type { BrabusClient } from "./client";
import type { EditableProfile } from "./profile";

export type SignUpInput = EditableProfile & {
  email: string;
  password: string;
  username: string;
  isCoach: boolean;
};

/**
 * Registro con email y contraseña. Los datos del perfil viajan como metadata y
 * el trigger `handle_new_user` crea el profile. `hasSession` es false si
 * Supabase exige confirmar el email antes de entrar.
 */
export async function signUp(
  client: BrabusClient,
  input: SignUpInput,
  options: { emailRedirectTo?: string } = {},
): Promise<ActionResult<{ hasSession: boolean }>> {
  const email = input.email.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const username = input.username.trim().toLowerCase();

  if (!email || !input.password || !firstName || !lastName) {
    return fail("Completá nombre, apellido, email y contraseña.");
  }
  if (input.password.length < 6) {
    return fail("La contraseña debe tener al menos 6 caracteres.");
  }
  const uErr = usernameError(username);
  if (uErr) return fail(`Nombre de usuario: ${uErr}`);

  const { data, error } = await client.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: options.emailRedirectTo,
      data: {
        first_name: firstName,
        last_name: lastName,
        birth_date: input.birthDate || null,
        height_cm: parseDecimal(input.heightCm),
        weight_kg: parseDecimal(input.weightKg),
        username,
        is_coach: input.isCoach,
      },
    },
  });

  if (error) return fail(error.message);
  return ok({ hasSession: Boolean(data.session) });
}
