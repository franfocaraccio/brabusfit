"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { usernameError } from "@/lib/username";

export type ProfileResult = { error: string } | undefined;

/**
 * ¿Está disponible el username? Optimista ante error de RPC (no bloquea si la
 * migración aún no corrió); la unicidad se garantiza igual a nivel DB.
 */
export async function checkUsername(
  username: string,
): Promise<{ available: boolean }> {
  if (usernameError(username)) return { available: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("username_available", {
    p_username: username,
  });
  if (error) return { available: true };
  return { available: data as boolean };
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
  input: EditableProfile,
): Promise<{ error?: string }> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { error: "Completá nombre y apellido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      birth_date: input.birthDate || null,
      height_cm: input.heightCm.trim() ? Number(input.heightCm) : null,
      weight_kg: input.weightKg.trim() ? Number(input.weightKg) : null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  return {};
}

export async function completeProfile(
  _prev: ProfileResult,
  formData: FormData,
): Promise<ProfileResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "").trim();
  const heightCm = String(formData.get("height_cm") ?? "").trim();
  const weightKg = String(formData.get("weight_kg") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const isCoach = ["on", "true"].includes(String(formData.get("is_coach")));

  if (!firstName || !lastName) {
    return { error: "Completá nombre y apellido." };
  }
  const uErr = usernameError(username);
  if (uErr) return { error: `Nombre de usuario: ${uErr}` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      birth_date: birthDate || null,
      height_cm: heightCm ? Number(heightCm) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      username,
      is_coach: isCoach,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese nombre de usuario ya está en uso." };
    }
    return { error: error.message };
  }

  redirect("/dashboard");
}
