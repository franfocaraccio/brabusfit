import { ScrollView, StyleSheet } from "react-native";

import { MyCoaches } from "@/components/my-coaches";
import { colors } from "@/lib/theme";

/** Ajustes → Mis coaches (solo alumnos): invitaciones y coaches vinculados. */
export default function CoachesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <MyCoaches />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
});
