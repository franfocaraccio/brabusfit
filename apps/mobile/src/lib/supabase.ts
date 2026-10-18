import "expo-sqlite/localStorage/install";

import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import type { Database } from "@brabus/shared";
import type { BrabusClient } from "@brabus/supabase";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Cliente de Supabase para la app mobile. La sesión se guarda con
 * expo-sqlite/localStorage (persiste entre aperturas de la app).
 * Solo usa la clave PÚBLICA: los permisos los controla la base (RLS).
 */
export const supabase: BrabusClient = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
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
