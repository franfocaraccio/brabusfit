import { Pressable, Text, View } from "react-native";

import { EXERCISE_VARIANTS } from "@brabus/shared";

import { fonts, makeStyles } from "@/lib/theme";

/** Variante con la que hizo el ejercicio (tocar la elegida la desmarca). */
export function VariantPicker({
  value,
  onToggle,
}: {
  value: string | null;
  onToggle: (variant: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>Variante</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {EXERCISE_VARIANTS.map((v) => {
          const selected = value === v;
          return (
            <Pressable
              key={v}
              onPress={() => onToggle(v)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {v}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.input,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  chipTextOn: { color: colors.primaryForeground },
}));
