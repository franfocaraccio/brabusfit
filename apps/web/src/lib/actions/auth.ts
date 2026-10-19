"use server";

import { redirect } from "next/navigation";

import { signUp } from "@brabus/supabase";

import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | undefined;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signUpAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  const result = await signUp(
    await createClient(),
    {
      email: field("email"),
      password: String(formData.get("password") ?? ""),
      firstName: field("first_name"),
      lastName: field("last_name"),
      birthDate: field("birth_date") || null,
      heightCm: field("height_cm"),
      weightKg: field("weight_kg"),
      username: field("username"),
      // base-ui Checkbox puede serializar el valor como "on" o "true" cuando
      // está marcado; ausente o "false"/"off" cuando no lo está.
      isCoach: ["on", "true"].includes(String(formData.get("is_coach"))),
    },
    { emailRedirectTo: `${siteUrl()}/auth/callback` },
  );

  if (!result.ok) {
    return { error: result.error };
  }

  // Si las confirmaciones por email están activas, no hay sesión todavía.
  if (!result.data.hasSession) {
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
