import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Card, Muted } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

/** Reportes (check-in): todavía no está disponible (igual que /reportes en la web). */
export default function ReportesScreen() {
  return (
    <View style={styles.screen}>
      <Card style={styles.card}>
        <Ionicons name="clipboard-outline" size={32} color={colors.primary} />
        <Text style={styles.title}>Próximamente</Text>
        <Muted style={{ textAlign: "center" }}>
          Acá vas a poder cargar tu peso, medidas y fotos, y ver tu evolución.
        </Muted>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 16 },
  card: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
});
