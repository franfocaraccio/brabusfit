import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import type { Database } from "@brabus/shared";
import type { BrabusClient } from "@brabus/supabase";

import { authStorage } from "./storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Cliente de Supabase para la app mobile. La sesión se guarda con
 * expo-sqlite/localStorage (persiste entre aperturas de la app).
 * Solo usa la clave PÚBLICA: los permisos los controla la base (RLS).
 * PKCE: el login con Google vuelve a la app con un `code` que se canjea acá.
 */
export const supabase: BrabusClient = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);

// Refresca el token solo mientras la app está en primer plano.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
