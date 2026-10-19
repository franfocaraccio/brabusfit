import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import { signInWithGoogle } from "@/lib/google-auth";
import { colors, fonts } from "@/lib/theme";

/** "Continuar con Google" + separador "o", como en la web. */
export function GoogleButton({ onError }: { onError: (msg: string | null) => void }) {
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    setLoading(true);
    onError(null);
    const error = await signInWithGoogle();
    setLoading(false);
    if (error) onError(error);
  };

  return (
    <>
      <Button
        title="Continuar con Google"
        variant="outline"
        onPress={onPress}
        loading={loading}
        icon={<Ionicons name="logo-google" size={18} color={colors.foreground} />}
      />
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>o</Text>
        <View style={styles.line} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.mutedForeground, fontFamily: fonts.regular, fontSize: 13 },
});
