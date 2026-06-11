import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Lee/escribe la sesión desde las cookies de la request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll puede fallar si se llama desde un Server Component.
            // El middleware se encarga de refrescar la sesión, así que es seguro ignorarlo.
          }
        },
      },
    },
  );
}

/**
 * Cliente con service role (bypassa RLS). SOLO para usar en el servidor en
 * operaciones administrativas controladas (ej. invitar usuarios por email).
 * Nunca exponer la service role key al cliente.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}
