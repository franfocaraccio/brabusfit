import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Card, Muted } from "@/components/ui";
import { fonts, makeStyles, useTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}[] = [
  {
    value: "dark",
    label: "Oscuro",
    hint: "El de siempre.",
    icon: "moon-outline",
  },
  {
    value: "light",
    label: "Claro",
    hint: "Fondo crema, ideal de día.",
    icon: "sunny-outline",
  },
  {
    value: "system",
    label: "Automático",
    hint: "Sigue la configuración de tu teléfono.",
    icon: "phone-portrait-outline",
  },
];

/** Ajustes → Apariencia (igual que /ajustes/apariencia en la web). */
export default function AparienciaScreen() {
  const styles = useStyles();
  const { preference, setPreference, colors } = useTheme();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.list}>
        {OPTIONS.map((o, i) => {
          const selected = preference === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => setPreference(o.value)}
              style={({ pressed }) => [
                styles.row,
                i < OPTIONS.length - 1 && styles.rowBorder,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Ionicons name={o.icon} size={20} color={colors.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{o.label}</Text>
                <Text style={styles.hint}>{o.hint}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={colors.primaryForeground}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </Card>
      <Muted style={{ fontSize: 12 }}>
        Se guarda en este teléfono: podés usar uno distinto en la compu.
      </Muted>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  list: { paddingVertical: 0, paddingHorizontal: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.foreground },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
}));
