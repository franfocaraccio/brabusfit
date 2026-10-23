import { ScrollView } from "react-native";

import { MyCoaches } from "@/components/my-coaches";
import { makeStyles } from "@/lib/theme";

/** Ajustes → Mis coaches (solo alumnos): invitaciones y coaches vinculados. */
export default function CoachesScreen() {
  const styles = useStyles();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <MyCoaches />
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
}));
