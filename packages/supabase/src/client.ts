import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@brabus/shared";

/**
 * Cliente de Supabase tipado con nuestra base. Cada app crea el suyo
 * (web: @supabase/ssr con cookies; mobile: supabase-js con SecureStore) y se
 * lo pasa a las funciones de este paquete.
 */
export type BrabusClient = SupabaseClient<Database>;

/** Id del usuario autenticado, o null. */
export async function getUserId(client: BrabusClient): Promise<string | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}
