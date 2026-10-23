import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { completeOAuthRedirect } from "@/lib/google-auth";
import { supabase } from "@/lib/supabase";
import { makeStyles, useColors } from "@/lib/theme";

/**
 * Destino del redirect de Google cuando el sistema abre la app con el link
 * (en vez de devolverlo a openAuthSessionAsync). Canjea el código si hace falta
 * y vuelve al inicio; los guards del layout deciden la pantalla.
 */
export default function AuthCallbackScreen() {
  const colors = useColors();
  const styles = useStyles();
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
      <ActivityIndicator color={colors.primaryText} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
}));
