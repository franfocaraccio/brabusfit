import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { sanitizeDecimal, type WorkoutRow } from "@brabus/shared";

import { TextField } from "@/components/ui";
import { fonts, makeStyles, useColors } from "@/lib/theme";

const onlyDigits = (v: string) => v.replace(/[^0-9]/g, "");

/** Una serie: peso, reps, "hecha" (si hay descanso) y quitar. */
export function SetRow({
  index,
  row,
  withRest,
  canRemove,
  onChange,
  onToggleDone,
  onRemove,
}: {
  index: number;
  row: WorkoutRow;
  /** El ejercicio tiene descanso: se muestra el botón de serie hecha. */
  withRest: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<Pick<WorkoutRow, "weight" | "reps">>) => void;
  onToggleDone: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>Serie {index + 1}</Text>
      <View style={{ flex: 1 }}>
        <TextField
          value={row.weight}
          onChangeText={(v) => onChange({ weight: sanitizeDecimal(v) })}
          placeholder="Peso"
          keyboardType="decimal-pad"
          style={styles.compactInput}
          suffix={row.weight.trim() !== "" ? "Kg" : undefined}
        />
      </View>
      <View style={{ flex: 1 }}>
        <TextField
          value={row.reps}
          onChangeText={(v) => onChange({ reps: onlyDigits(v) })}
          placeholder="Reps"
          keyboardType="number-pad"
          style={styles.compactInput}
        />
      </View>
      {withRest ? (
        <Pressable
          onPress={onToggleDone}
          hitSlop={6}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!row.done }}
          accessibilityLabel={`Serie ${index + 1} hecha, descansar`}
          style={[styles.setCheck, row.done && styles.setCheckOn]}
        >
          <Ionicons
            name="checkmark"
            size={18}
            color={row.done ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onRemove}
        disabled={!canRemove}
        hitSlop={8}
        accessibilityLabel="Quitar serie"
        style={{ opacity: canRemove ? 1 : 0.3 }}
      >
        <Ionicons name="trash-outline" size={20} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  setRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  setLabel: {
    width: 54,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  // Campos más bajos que el estándar (48) para que la lista de series sea
  // compacta; sigue siendo cómodo de tocar (≥ 38).
  compactInput: { minHeight: 40, paddingVertical: 6, fontSize: 15 },
  setCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  setCheckOn: { backgroundColor: colors.primary, borderColor: colors.primary },
}));
