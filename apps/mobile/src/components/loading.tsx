import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Muted } from "@/components/ui";
import { colors } from "@/lib/theme";

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function NotFound({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Muted>{text}</Muted>
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
