import { Ionicons } from "@expo/vector-icons";
import { useState, type Dispatch } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  formatRest,
  NOTE_MAX_LENGTH,
  summarizeHistory,
  type TrainingExercise,
  type WorkoutAction,
  type WorkoutRow,
} from "@brabus/shared";

import { Button } from "@/components/ui";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

import { ExerciseHistory } from "./exercise-history";
import { SetRow } from "./set-row";
import { VariantPicker } from "./variant-picker";

/**
 * Un ejercicio del día: círculo para completarlo, encabezado que lo expande y,
 * abierto, historial, variante, series, detalle y "Guardar ejercicio".
 */
export function ExerciseCard({
  exercise: ex,
  isOpen,
  isDone,
  rows,
  variant,
  note,
  dispatch,
  newKey,
  onToggleOpen,
  onToggleDone,
  onSetDone,
  onShowAllHistory,
  onSave,
}: {
  exercise: TrainingExercise;
  isOpen: boolean;
  isDone: boolean;
  rows: WorkoutRow[];
  variant: string | null;
  note: string;
  dispatch: Dispatch<WorkoutAction>;
  newKey: () => string;
  onToggleOpen: () => void;
  onToggleDone: () => void;
  onSetDone: (row: WorkoutRow) => void;
  onShowAllHistory: () => void;
  onSave: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  // Se conserva al plegar y desplegar el ejercicio.
  const [historyOpen, setHistoryOpen] = useState(false);
  const exerciseId = ex.id;

  return (
    <View style={[styles.exercise, isDone && !isOpen && { opacity: 0.6 }]}>
      {/* Encabezado: círculo (completar) + nombre (expandir) */}
      <View style={styles.exerciseHeader}>
        <Pressable
          onPress={onToggleDone}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDone }}
          accessibilityLabel={`Completar ${ex.name}`}
          style={styles.checkHit}
        >
          <View style={[styles.check, isDone && styles.checkDone]}>
            {isDone ? (
              <Ionicons
                name="checkmark"
                size={16}
                color={colors.successForeground}
              />
            ) : null}
          </View>
        </Pressable>
        <Pressable
          style={styles.exerciseTitleArea}
          onPress={onToggleOpen}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseName}>{ex.name}</Text>
            <Text style={styles.exerciseSets}>
              {ex.setsReps}
              {ex.restSeconds
                ? ` · Descanso ${formatRest(ex.restSeconds)}`
                : ""}
            </Text>
            {ex.history[0] ? (
              <Text style={styles.exerciseLast}>
                {summarizeHistory(ex.history[0])}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name={isOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      {isOpen && (
        <View style={styles.exerciseBody}>
          {ex.history.length > 0 && (
            <ExerciseHistory
              history={ex.history}
              open={historyOpen}
              onToggle={() => setHistoryOpen((o) => !o)}
              onShowAll={onShowAllHistory}
            />
          )}

          <VariantPicker
            value={variant}
            onToggle={(v) =>
              dispatch({ type: "toggleVariant", exerciseId, variant: v })
            }
          />

          {rows.map((row, i) => (
            <SetRow
              key={row.key}
              index={i}
              row={row}
              withRest={!!ex.restSeconds}
              canRemove={rows.length > 1}
              onChange={(patch) =>
                dispatch({ type: "setRow", exerciseId, key: row.key, patch })
              }
              onToggleDone={() => onSetDone(row)}
              onRemove={() =>
                dispatch({ type: "removeRow", exerciseId, key: row.key })
              }
            />
          ))}

          <Button
            title="Agregar serie"
            variant="outline"
            onPress={() =>
              dispatch({ type: "addRow", exerciseId, key: newKey() })
            }
            icon={<Ionicons name="add" size={18} color={colors.foreground} />}
            style={styles.compactButton}
          />

          <View style={{ gap: 6 }}>
            <Text style={styles.noteLabel}>Detalle (opcional)</Text>
            {/* Una línea; crece sola si el texto no entra. */}
            <TextInput
              value={note}
              onChangeText={(v) =>
                dispatch({ type: "setNote", exerciseId, note: v })
              }
              maxLength={NOTE_MAX_LENGTH}
              placeholder="Ej: agarre cerrado"
              placeholderTextColor={colors.mutedForeground}
              selectionColor={colors.primary}
              multiline
              style={styles.note}
            />
          </View>

          <Button
            title="Guardar ejercicio"
            onPress={onSave}
            style={styles.saveExerciseButton}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  exercise: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.overlay,
    overflow: "hidden",
  },
  exerciseHeader: { flexDirection: "row", alignItems: "center" },
  checkHit: { paddingLeft: 14, paddingRight: 6, paddingVertical: 16 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.mutedForeground,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  exerciseTitleArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingLeft: 6,
    paddingRight: 14,
  },
  exerciseName: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.foreground,
  },
  exerciseSets: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  exerciseLast: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  exerciseBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 14,
    gap: 12,
  },
  // Botón secundario más bajo que el estándar (48), igual que las series.
  compactButton: { minHeight: 40 },
  // Mínimo recomendado por Apple para un objetivo táctil.
  saveExerciseButton: { minHeight: 44 },
  noteLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  note: {
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.field,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlignVertical: "top",
  },
}));
