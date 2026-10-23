import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Card, Muted } from "@/components/ui";
import { fonts, makeStyles, useColors } from "@/lib/theme";

/** Reportes (check-in): todavía no está disponible (igual que /reportes en la web). */
export default function ReportesScreen() {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.screen}>
      <Card style={styles.card}>
        <Ionicons name="clipboard-outline" size={32} color={colors.primaryText} />
        <Text style={styles.title}>Próximamente</Text>
        <Muted style={{ textAlign: "center" }}>
          Acá vas a poder cargar tu peso, medidas y fotos, y ver tu evolución.
        </Muted>
      </Card>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background, padding: 16 },
  card: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
}));
