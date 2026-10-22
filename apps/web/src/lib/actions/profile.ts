"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import * as db from "@brabus/supabase";
import type { EditableProfile } from "@brabus/supabase";

import { createClient } from "@/lib/supabase/server";

export type ProfileResult = { error: string } | undefined;
export type { EditableProfile } from "@brabus/supabase";

/** ¿Está disponible el username? (validación en vivo del formulario) */
export async function checkUsername(
  username: string,
): Promise<{ available: boolean }> {
  const available = await db.isUsernameAvailable(await createClient(), username);
  return { available };
}

/**
 * Actualiza los datos editables del perfil (nombre, apellido, nacimiento,
 * altura, peso). NO toca email, rol (is_coach) ni onboarded.
 */
export async function updateProfile(
  input: EditableProfile,
): Promise<{ error?: string }> {
  const result = await db.updateProfile(await createClient(), input);
  if (!result.ok) return { error: result.error };
  revalidatePath("/ajustes", "layout");
  return {};
}

export async function completeProfile(
  _prev: ProfileResult,
  formData: FormData,
): Promise<ProfileResult> {
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  const result = await db.completeProfile(await createClient(), {
    firstName: field("first_name"),
    lastName: field("last_name"),
    birthDate: field("birth_date") || null,
    heightCm: field("height_cm"),
    weightKg: field("weight_kg"),
    username: field("username"),
    isCoach: ["on", "true"].includes(String(formData.get("is_coach"))),
  });

  if (!result.ok) return { error: result.error };
  redirect("/dashboard");
}
