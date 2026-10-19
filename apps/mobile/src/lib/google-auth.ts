import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * Login con Google vía Supabase (OAuth + PKCE) en el navegador del sistema.
 *
 * La vuelta a la app usa la URL de Expo Go (`exp://u.expo.dev/...`) o, en una
 * build propia, `brabusfit://`. Ambas deben estar en Supabase → Authentication
 * → URL Configuration → Redirect URLs (`exp://u.expo.dev/**`, `brabusfit://**`).
 *
 * Devuelve un mensaje de error, o null si salió bien o el usuario canceló.
 */
export async function signInWithGoogle(): Promise<string | null> {
  const redirectTo = Linking.createURL("auth/callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return error?.message ?? "No se pudo iniciar el login con Google.";

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return null;

  return completeOAuthRedirect(result.url);
}

/** Canjea el `code` del redirect por una sesión. El AuthProvider navega solo. */
export async function completeOAuthRedirect(url: string): Promise<string | null> {
  const { queryParams } = Linking.parse(url);
  const errorDescription = queryParams?.error_description;
  if (typeof errorDescription === "string") return errorDescription;

  const code = queryParams?.code;
  if (typeof code !== "string") return "Google no devolvió un código de acceso.";

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? error.message : null;
}
