import { Text, View } from "react-native";

import {
  macroLine,
  sanitizeDecimal,
  type MacroRange,
  type PlanTargetField,
  type PlanTargets,
} from "@brabus/shared";

import { Card, TextField } from "@/components/ui";
import { fonts, makeStyles } from "@/lib/theme";

const TARGETS: readonly (readonly [PlanTargetField, string])[] = [
  ["target_kcal", "Calorías"],
  ["target_protein", "Proteínas (g)"],
  ["target_carbs", "Carbohidratos (g)"],
  ["target_fat", "Grasas (g)"],
  ["target_water_l", "Agua (L)"],
];

/** Objetivos del plan (kcal, macros, agua) e indicaciones generales. */
export function PlanTargetsCard({
  day,
  targets,
  guidelines,
  onTargetChange,
  onGuidelinesChange,
}: {
  /** Totales del plan tal como está armado. */
  day: MacroRange;
  targets: PlanTargets;
  guidelines: string;
  onTargetChange: (field: PlanTargetField, value: string) => void;
  onGuidelinesChange: (value: string) => void;
}) {
  const styles = useStyles();
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Objetivos (opcional)</Text>
      {day.hasData ? (
        <Text style={styles.hint}>Plan actual: {macroLine(day)}</Text>
      ) : null}
      <View style={styles.targetGrid}>
        {TARGETS.map(([key, label]) => (
          <View key={key} style={styles.targetCell}>
            <TextField
              label={label}
              value={targets[key]}
              onChangeText={(v) => onTargetChange(key, sanitizeDecimal(v))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={styles.compact}
            />
          </View>
        ))}
      </View>
      <TextField
        label="Indicaciones generales (opcional)"
        value={guidelines}
        onChangeText={onGuidelinesChange}
        multiline
        style={styles.multiline}
        placeholder="Hidratación, suplementos, alimentos a evitar…"
      />
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { padding: 14, gap: 12 },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.foreground,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  targetGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  targetCell: { width: "50%", paddingHorizontal: 4, paddingBottom: 8 },
  compact: { minHeight: 40, paddingVertical: 6, fontSize: 15 },
  multiline: { minHeight: 72, textAlignVertical: "top", paddingTop: 12 },
}));
