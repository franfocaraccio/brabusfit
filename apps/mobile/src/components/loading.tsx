import { ActivityIndicator, View } from "react-native";

import { Muted } from "@/components/ui";
import { makeStyles, useColors } from "@/lib/theme";

export function Loading() {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primaryText} />
    </View>
  );
}

export function NotFound({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.center}>
      <Muted>{text}</Muted>
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
