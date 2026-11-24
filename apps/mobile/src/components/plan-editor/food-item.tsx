import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import {
  sanitizeDecimal,
  type PlanItemDraft,
  type PlanItemInput,
} from "@brabus/shared";

import { IconButton } from "@/components/routine-editor/icon-button";
import { TextField } from "@/components/ui";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

const MACROS = [
  ["kcal", "kcal"],
  ["protein", "Prot."],
  ["carbs", "Carb."],
  ["fat", "Grasas"],
] as const;

/** Un alimento: nombre y quitar, cantidad y unidad, y macros. */
export function FoodItem({
  item,
  onChange,
  onRemove,
  onPickUnit,
}: {
  item: PlanItemDraft;
  onChange: (patch: Partial<PlanItemInput>) => void;
  onRemove: () => void;
  /** Abre el selector de unidad. */
  onPickUnit: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.item}>
      <View style={styles.itemRow}>
        <View style={{ flex: 1 }}>
          <TextField
            value={item.food}
            onChangeText={(v) => onChange({ food: v })}
            placeholder="Alimento (ej: Avena)"
            style={styles.compact}
            accessibilityLabel="Alimento"
          />
        </View>
        <IconButton
          narrow
          icon="close"
          label="Quitar alimento"
          onPress={onRemove}
        />
      </View>
      <View style={styles.itemRow}>
        <View style={{ width: 80 }}>
          <TextField
            value={item.amount}
            onChangeText={(v) => onChange({ amount: v })}
            placeholder="Cant."
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={styles.compact}
            accessibilityLabel="Cantidad"
          />
        </View>
        <Pressable
          onPress={onPickUnit}
          style={styles.unit}
          accessibilityRole="button"
          accessibilityLabel="Unidad"
        >
          <Text
            style={[
              styles.unitText,
              !item.unit && { color: colors.mutedForeground },
            ]}
            numberOfLines={1}
          >
            {item.unit || "Unidad"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>
      <View style={styles.itemRow}>
        {MACROS.map(([key, label]) => (
          <View key={key} style={{ flex: 1, gap: 2 }}>
            <Text style={styles.macroLabel}>{label}</Text>
            <TextField
              value={item[key]}
              onChangeText={(v) => onChange({ [key]: sanitizeDecimal(v) })}
              placeholder="—"
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={[styles.compact, styles.macro]}
              accessibilityLabel={label}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  item: {
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  compact: { minHeight: 40, paddingVertical: 6, fontSize: 15 },
  macro: { paddingHorizontal: 8, textAlign: "center" },
  macroLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  // Mismo aspecto que un selector, más bajo.
  unit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.field,
  },
  unitText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.foreground,
  },
}));
