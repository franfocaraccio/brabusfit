import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import {
  restLabel,
  type CatalogEntry,
  type RoutineExerciseDraft,
} from "@brabus/shared";

import { ExercisePicker } from "@/components/exercise-picker";
import { TextField } from "@/components/ui";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

import { IconButton } from "./icon-button";

/**
 * Un ejercicio del día: catálogo, series/reps, variante, descanso y la columna
 * de acciones (subir, eliminar, bajar).
 */
export function ExerciseRow({
  exercise: ex,
  catalog,
  isFirst,
  isLast,
  canRemove,
  onChange,
  onCatalogCreated,
  onPickRest,
  onMove,
  onRemove,
}: {
  exercise: RoutineExerciseDraft;
  catalog: CatalogEntry[];
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<Omit<RoutineExerciseDraft, "key" | "id">>) => void;
  onCatalogCreated: (entry: CatalogEntry) => void;
  /** Abre el selector de descanso. */
  onPickRest: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.exercise}>
      <View style={{ flex: 1, gap: 8 }}>
        <ExercisePicker
          value={ex.catalog}
          catalog={catalog}
          onChange={(entry) => onChange({ catalog: entry })}
          onCreated={onCatalogCreated}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={ex.sets_reps}
              onChangeText={(v) => onChange({ sets_reps: v })}
              placeholder="4 x (10 a 12)"
              accessibilityLabel="Series y repeticiones"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              value={ex.variant}
              onChangeText={(v) => onChange({ variant: v })}
              placeholder="Variante"
              accessibilityLabel="Variante"
            />
          </View>
        </View>
        <Pressable
          onPress={onPickRest}
          style={styles.restPill}
          accessibilityRole="button"
          accessibilityLabel="Descanso entre series"
        >
          <Ionicons
            name="timer-outline"
            size={15}
            color={colors.mutedForeground}
          />
          <Text style={styles.restText}>{restLabel(ex.rest)}</Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>
      <View style={styles.exerciseActions}>
        <IconButton
          compact
          icon="chevron-up"
          label="Subir ejercicio"
          onPress={() => onMove(-1)}
          disabled={isFirst}
        />
        <IconButton
          compact
          icon="trash-outline"
          label="Eliminar ejercicio"
          onPress={onRemove}
          disabled={!canRemove}
        />
        <IconButton
          compact
          icon="chevron-down"
          label="Bajar ejercicio"
          onPress={() => onMove(1)}
          disabled={isLast}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  exercise: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.subtle,
  },
  exerciseActions: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  restPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.field,
  },
  restText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.foreground,
  },
}));
