import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams, useNavigation } from "expo-router";
// SDK 57: usePreventRemove todavía no se exporta desde "expo-router".
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  formatShortDate,
  formatWeight,
  NOTE_MAX_LENGTH,
  parseDecimal,
  sanitizeDecimal,
  summarizeHistory,
  type ExerciseLogInput,
  type TrainingExercise,
} from "@brabus/shared";
import { getTrainingDay, saveWorkout } from "@brabus/supabase";

import { Button, Muted, TextField } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type SetRow = { key: string; weight: string; reps: string };

let keySeq = 0;
const newKey = () => `row-${++keySeq}`;
const emptyRow = (): SetRow => ({ key: newKey(), weight: "", reps: "" });

/** Series iniciales: las del último entrenamiento, o una fila vacía. */
function initialRowsFor(ex: TrainingExercise): SetRow[] {
  const last = ex.history[0];
  if (!last || last.sets.length === 0) return [emptyRow()];
  return last.sets.map((s) => ({
    key: newKey(),
    weight: s.weight !== null ? formatWeight(s.weight) : "",
    reps: s.reps !== null ? String(s.reps) : "",
  }));
}

const rowsSignature = (rs: SetRow[]) =>
  rs.map((r) => `${r.weight.trim()}|${r.reps.trim()}`).join(";");

const onlyDigits = (v: string) => v.replace(/[^0-9]/g, "");

// ---------------------------------------------------------------------------
// Pantalla: carga los datos y monta el entrenador
// ---------------------------------------------------------------------------

export default function TrainDayScreen() {
  const { id: routineId, dayId } = useLocalSearchParams<{
    id: string;
    dayId: string;
  }>();
  const { session } = useAuth();
  const [data, setData] = useState<
    Awaited<ReturnType<typeof getTrainingDay>> | undefined
  >(undefined);

  useEffect(() => {
    if (!session) return;
    getTrainingDay(supabase, {
      userId: session.user.id,
      routineId,
      dayId,
    }).then(setData);
  }, [session, routineId, dayId]);

  if (data === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (data === null) {
    return (
      <View style={styles.center}>
        <Muted>No se encontró este día de la rutina.</Muted>
      </View>
    );
  }

  return (
    <Trainer
      routineId={routineId}
      dayId={dayId}
      dayName={data.day.name}
      exercises={data.exercises}
    />
  );
}

// ---------------------------------------------------------------------------
// Entrenador (todo en memoria hasta "Guardar sesión")
// ---------------------------------------------------------------------------

function Trainer({
  routineId,
  dayId,
  dayName,
  exercises,
}: {
  routineId: string;
  dayId: string;
  dayName: string;
  exercises: TrainingExercise[];
}) {
  const [saving, startSaving] = useTransition();
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Record<string, SetRow[]>>(() =>
    Object.fromEntries(exercises.map((e) => [e.id, initialRowsFor(e)])),
  );
  const [initialSignatures] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(rows).map(([id, rs]) => [id, rowsSignature(rs)]),
    ),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});

  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = exercises.length > 0 && completedCount === exercises.length;

  const dirty =
    completedCount > 0 ||
    Object.values(notes).some((n) => n.trim() !== "") ||
    Object.entries(rows).some(
      ([id, rs]) => rowsSignature(rs) !== initialSignatures[id],
    );

  // Aviso al salir con cambios sin guardar (botón atrás y gesto de swipe).
  // "leaving" apaga el aviso cuando salimos a propósito (después de guardar).
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);

  usePreventRemove(dirty && !leaving, ({ data }) => {
    confirm({
      title: "Los cambios no fueron guardados",
      message: 'Si salís ahora se pierde lo que cargaste. Para guardarlo usá "Guardar sesión".',
      cancelText: "Seguir entrenando",
      confirmText: "Salir sin guardar",
      destructive: true,
      onConfirm: () => navigation.dispatch(data.action),
    });
  });

  // Volver atrás recién cuando el aviso ya está desactivado.
  useEffect(() => {
    if (leaving) router.back();
  }, [leaving]);

  // --- mutadores ------------------------------------------------------------
  const setRow = (exId: string, key: string, patch: Partial<SetRow>) =>
    setRows((prev) => ({
      ...prev,
      [exId]: prev[exId].map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));

  const addRow = (exId: string) =>
    setRows((prev) => ({ ...prev, [exId]: [...prev[exId], emptyRow()] }));

  const removeRow = (exId: string, key: string) =>
    setRows((prev) => ({
      ...prev,
      [exId]:
        prev[exId].length > 1 ? prev[exId].filter((r) => r.key !== key) : prev[exId],
    }));

  const toggleDone = (exId: string) => {
    Haptics.selectionAsync();
    setCompleted((c) => ({ ...c, [exId]: !c[exId] }));
  };

  const saveExercise = (exId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCompleted((c) => ({ ...c, [exId]: true }));
    setOpenId(null);
  };

  // --- guardar sesión ---------------------------------------------------------
  const doSave = () => {
    const logs: ExerciseLogInput[] = exercises
      .filter((ex) => completed[ex.id])
      .map((ex) => ({
        exerciseId: ex.id,
        note: notes[ex.id] ?? null,
        sets: rows[ex.id].map((r, i) => ({
          set_number: i + 1,
          weight: parseDecimal(r.weight),
          reps: r.reps.trim() === "" ? null : Number(r.reps),
        })),
      }));

    startSaving(async () => {
      const res = await saveWorkout(supabase, routineId, dayId, logs);
      if (!res.ok) {
        notify("No se pudo guardar", res.error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLeaving(true);
    });
  };

  const onSavePress = () => {
    if (allDone) {
      doSave();
      return;
    }
    confirm({
      title: "Todavía no terminaste",
      message: `Te quedan ${exercises.length - completedCount} ejercicios sin guardar. Se registran solo los ${completedCount} que guardaste. ¿Querés guardar la sesión igualmente?`,
      cancelText: "Seguir entrenando",
      confirmText: "Guardar igualmente",
      onConfirm: doSave,
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <Stack.Screen options={{ title: dayName }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Muted>
          {completedCount} de {exercises.length} ejercicios completados
        </Muted>

        {exercises.map((ex) => {
          const isOpen = openId === ex.id;
          const isDone = !!completed[ex.id];
          return (
            <View
              key={ex.id}
              style={[styles.exercise, isDone && !isOpen && { opacity: 0.6 }]}
            >
              {/* Encabezado: círculo (completar) + nombre (expandir) */}
              <View style={styles.exerciseHeader}>
                <Pressable
                  onPress={() => toggleDone(ex.id)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isDone }}
                  accessibilityLabel={`Completar ${ex.name}`}
                  style={styles.checkHit}
                >
                  <View style={[styles.check, isDone && styles.checkDone]}>
                    {isDone ? (
                      <Ionicons name="checkmark" size={16} color={colors.successForeground} />
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  style={styles.exerciseTitleArea}
                  onPress={() => setOpenId(isOpen ? null : ex.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseSets}>{ex.setsReps}</Text>
                    {ex.history[0] ? (
                      <Text style={styles.exerciseLast}>{summarizeHistory(ex.history[0])}</Text>
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
                    <View style={{ gap: 6 }}>
                      <Pressable
                        onPress={() =>
                          setHistoryOpen((h) => ({ ...h, [ex.id]: !h[ex.id] }))
                        }
                        style={styles.historyToggle}
                      >
                        <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
                        <Text style={styles.historyToggleText}>
                          Últimos {ex.history.length} entrenamientos
                        </Text>
                        <Ionicons
                          name={historyOpen[ex.id] ? "chevron-up" : "chevron-down"}
                          size={15}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                      {historyOpen[ex.id] &&
                        ex.history.map((h, i) => (
                          <View key={i} style={styles.historyRow}>
                            <Text style={styles.historyDate}>{formatShortDate(h.date)}</Text>
                            <Text style={styles.historySets}>{summarizeHistory(h)}</Text>
                          </View>
                        ))}
                      <Muted style={{ fontSize: 13 }}>
                        Precargado con tu entrenamiento del{" "}
                        {formatShortDate(ex.history[0].date)}. Si progresaste, editalo.
                      </Muted>
                    </View>
                  )}

                  {rows[ex.id].map((row, i) => (
                    <View key={row.key} style={styles.setRow}>
                      <Text style={styles.setLabel}>Serie {i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <TextField
                          value={row.weight}
                          onChangeText={(v) =>
                            setRow(ex.id, row.key, { weight: sanitizeDecimal(v) })
                          }
                          placeholder="Peso"
                          keyboardType="decimal-pad"
                          suffix={row.weight.trim() !== "" ? "Kg" : undefined}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextField
                          value={row.reps}
                          onChangeText={(v) => setRow(ex.id, row.key, { reps: onlyDigits(v) })}
                          placeholder="Reps"
                          keyboardType="number-pad"
                        />
                      </View>
                      <Pressable
                        onPress={() => removeRow(ex.id, row.key)}
                        disabled={rows[ex.id].length === 1}
                        hitSlop={8}
                        accessibilityLabel="Quitar serie"
                        style={{ opacity: rows[ex.id].length === 1 ? 0.3 : 1 }}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.foreground} />
                      </Pressable>
                    </View>
                  ))}

                  <Button
                    title="Agregar serie"
                    variant="outline"
                    onPress={() => addRow(ex.id)}
                    icon={<Ionicons name="add" size={18} color={colors.foreground} />}
                  />

                  <View style={{ gap: 6 }}>
                    <View style={styles.noteHeader}>
                      <Text style={styles.noteLabel}>Detalle (opcional)</Text>
                      <Text style={styles.noteCount}>
                        {(notes[ex.id] ?? "").length}/{NOTE_MAX_LENGTH}
                      </Text>
                    </View>
                    {/* Una línea; crece sola si el texto no entra. */}
                    <TextInput
                      value={notes[ex.id] ?? ""}
                      onChangeText={(v) => setNotes((n) => ({ ...n, [ex.id]: v }))}
                      maxLength={NOTE_MAX_LENGTH}
                      placeholder="Ej: hecho en Smith"
                      placeholderTextColor={colors.mutedForeground}
                      selectionColor={colors.primary}
                      multiline
                      style={styles.note}
                    />
                  </View>

                  <Button title="Guardar ejercicio" onPress={() => saveExercise(ex.id)} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Guardar sesión"
          variant={completedCount > 0 ? "primary" : "secondary"}
          disabled={completedCount === 0}
          loading={saving}
          onPress={onSavePress}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  exercise: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(244,246,250,0.08)",
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
  exerciseName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
  exerciseSets: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
  exerciseLast: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "rgba(244,246,250,0.7)",
  },
  exerciseBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 14,
    gap: 12,
  },
  historyToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyToggleText: { fontFamily: fonts.medium, fontSize: 13, color: colors.mutedForeground },
  historyRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(32,38,47,0.6)",
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyDate: { fontFamily: fonts.medium, fontSize: 13, color: colors.mutedForeground },
  historySets: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.foreground },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  setLabel: { width: 54, fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
  noteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  noteLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.mutedForeground },
  noteCount: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  note: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: "rgba(43,51,61,0.4)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
