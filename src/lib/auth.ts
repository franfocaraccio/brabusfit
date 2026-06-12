import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/**
 * Devuelve el usuario autenticado y su profile. Redirige a /login si no hay
 * sesión. Usar en Server Components/Actions del grupo (app).
 */
export async function requireProfile(opts?: {
  skipOnboarding?: boolean;
}): Promise<{
  userId: string;
  email: string;
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Caso borde: el trigger todavía no creó el profile. Cerramos sesión
    // para forzar un reintento limpio en el próximo login.
    await supabase.auth.signOut();
    redirect("/login?error=profile");
  }

  // Usuarios que entraron por SSO (Google) y todavía no completaron sus datos
  // (apellido, rol coach/alumno, datos físicos) van a la pantalla de onboarding.
  if (profile.onboarded === false && !opts?.skipOnboarding) {
    redirect("/completar-perfil");
  }

  return { userId: user.id, email: user.email ?? "", profile };
}
