import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { completeOAuthRedirect } from "@/lib/google-auth";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

/**
 * Destino del redirect de Google cuando el sistema abre la app con el link
 * (en vez de devolverlo a openAuthSessionAsync). Canjea el código si hace falta
 * y vuelve al inicio; los guards del layout deciden la pantalla.
 */
export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session && code) {
        await completeOAuthRedirect(`brabusfit://auth/callback?code=${code}`);
      }
      setDone(true);
    })();
  }, [code]);

  if (done) return <Redirect href="/" />;

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
