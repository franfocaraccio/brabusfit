"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseDecimal } from "@/lib/decimal";
import { usernameError } from "@/lib/username";

export type AuthResult = { error: string } | undefined;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signUpAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "").trim();
  const heightCm = String(formData.get("height_cm") ?? "").trim();
  const weightKg = String(formData.get("weight_kg") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  // base-ui Checkbox puede serializar el valor como "on" o "true" cuando está
  // marcado; ausente o "false"/"off" cuando no lo está.
  const isCoach = ["on", "true"].includes(String(formData.get("is_coach")));

  if (!email || !password || !firstName || !lastName) {
    return { error: "Completá nombre, apellido, email y contraseña." };
  }
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }
  const uErr = usernameError(username);
  if (uErr) return { error: `Nombre de usuario: ${uErr}` };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      // El trigger handle_new_user lee estos datos para crear el profile.
      data: {
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate || null,
        height_cm: parseDecimal(heightCm),
        weight_kg: parseDecimal(weightKg),
        username,
        is_coach: isCoach,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Si las confirmaciones por email están activas, no hay sesión todavía.
  if (!data.session) {
    redirect("/login?check_email=1");
  }

  redirect("/dashboard");
}

export async function signInAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresá tu email y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
