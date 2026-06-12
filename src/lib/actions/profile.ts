"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ProfileResult = { error: string } | undefined;

export async function completeProfile(
  _prev: ProfileResult,
  formData: FormData,
): Promise<ProfileResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "").trim();
  const heightCm = String(formData.get("height_cm") ?? "").trim();
  const weightKg = String(formData.get("weight_kg") ?? "").trim();
  const isCoach = ["on", "true"].includes(String(formData.get("is_coach")));

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
      birth_date: birthDate || null,
      height_cm: heightCm ? Number(heightCm) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      is_coach: isCoach,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  redirect("/dashboard");
}
