import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/**
 * Devuelve el usuario autenticado y su profile. Redirige a /login si no hay
 * sesión. Usar en Server Components/Actions del grupo (app).
 */
export async function requireProfile(): Promise<{
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

  return { userId: user.id, email: user.email ?? "", profile };
}
