import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams, useNavigation } from "expo-router";
// SDK 57: usePreventRemove todavía no se exporta desde "expo-router".
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
  clearDraft,
  describeDraft,
  draftKey,
  formatShortDate,
  loadDraft,
  saveDraft,
  HISTORY_PREVIEW,
  historyLabel,
  formatWeight,
  NOTE_MAX_LENGTH,
  parseDecimal,
  sanitizeDecimal,
  summarizeHistory,
  type ExerciseLogInput,
  type HistoryEntry,
  type TrainingExercise,
} from "@brabus/shared";
import { getTrainingDay, saveWorkout } from "@brabus/supabase";

import { Sheet } from "@/components/sheet";
import { Button, Muted, TextField } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { authStorage } from "@/lib/storage";
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
      userId={session!.user.id}
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
  userId,
  routineId,
  dayId,
  dayName,
  exercises,
}: {
  userId: string;
  routineId: string;
  dayId: string;
  dayName: string;
  exercises: TrainingExercise[];
}) {
  const [saving, startSaving] = useTransition();
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  // Ejercicio cuyo historial completo se muestra en el panel "Ver más".
  const [historySheet, setHistorySheet] = useState<TrainingExercise | null>(null);
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
  const draftId = draftKey(userId, dayId);

  usePreventRemove(dirty && !leaving, ({ data }) => {
    confirm({
      title: "Los cambios no fueron guardados",
      message: 'Si salís ahora se pierde lo que cargaste. Para guardarlo usá "Guardar sesión".',
      cancelText: "Seguir entrenando",
      confirmText: "Salir sin guardar",
      destructive: true,
      onConfirm: () => {
        // Salida a propósito: el respaldo ya no hace falta.
        clearDraft(authStorage, draftId);
        navigation.dispatch(data.action);
      },
    });
  });

  // --- Respaldo local por si la app se cierra de golpe ------------------------
  /** Guarda el borrador con el estado actual (al guardar/marcar un ejercicio). */
  const persistDraft = (nextCompleted: Record<string, boolean>) =>
    saveDraft(authStorage, draftId, {
      routineId,
      dayId,
      completed: Object.keys(nextCompleted).filter((id) => nextCompleted[id]),
      rows: Object.fromEntries(
        Object.entries(rows).map(([id, rs]) => [
          id,
          rs.map((r) => ({ weight: r.weight, reps: r.reps })),
        ]),
      ),
      notes,
    });

  // Al entrar: si quedó una sesión sin guardar (menos de 24 h), preguntamos.
  const askedDraftRef = useRef(false);
  useEffect(() => {
    if (askedDraftRef.current) return;
    askedDraftRef.current = true;
    const draft = loadDraft(authStorage, draftId);
    if (!draft) return;
    const ids = new Set(exercises.map((e) => e.id));
    confirm({
      title: "Tenés una sesión sin guardar",
      message: `${describeDraft(draft)} ¿Querés continuarla o empezar de nuevo?`,
      cancelText: "Descartar",
      confirmText: "Continuar sesión",
      onCancel: () => clearDraft(authStorage, draftId),
      onConfirm: () => {
        setCompleted(
          Object.fromEntries(draft.completed.filter((id) => ids.has(id)).map((id) => [id, true])),
        );
        setRows((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(draft.rows)
              .filter(([id, rs]) => ids.has(id) && rs.length > 0)
              .map(([id, rs]) => [id, rs.map((r) => ({ key: newKey(), ...r }))]),
          ),
        }));
        setNotes(Object.fromEntries(Object.entries(draft.notes).filter(([id]) => ids.has(id))));
      },
    });
  }, [draftId, exercises]);

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
    const next = { ...completed, [exId]: !completed[exId] };
    setCompleted(next);
    persistDraft(next);
  };

  const saveExercise = (exId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = { ...completed, [exId]: true };
    setCompleted(next);
    persistDraft(next);
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
      clearDraft(authStorage, draftId);
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
                          {historyLabel(ex.history.length)}
                        </Text>
                        <Ionicons
                          name={historyOpen[ex.id] ? "chevron-up" : "chevron-down"}
                          size={15}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                      {historyOpen[ex.id] &&
                        ex.history
                          .slice(0, HISTORY_PREVIEW)
                          .map((h, i) => <HistoryRow key={i} entry={h} />)}
                      {historyOpen[ex.id] && ex.history.length > HISTORY_PREVIEW ? (
                        <Pressable
                          onPress={() => setHistorySheet(ex)}
                          hitSlop={8}
                          accessibilityRole="button"
                          style={{ alignSelf: "flex-start" }}
                        >
                          <Text style={styles.seeMore}>Ver más</Text>
                        </Pressable>
                      ) : null}
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
                          style={styles.compactInput}
                          suffix={row.weight.trim() !== "" ? "Kg" : undefined}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextField
                          value={row.reps}
                          onChangeText={(v) => setRow(ex.id, row.key, { reps: onlyDigits(v) })}
                          placeholder="Reps"
                          keyboardType="number-pad"
                          style={styles.compactInput}
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
                    style={styles.compactButton}
                  />

                  <View style={{ gap: 6 }}>
                    <Text style={styles.noteLabel}>Detalle (opcional)</Text>
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

                  <Button
                    title="Guardar ejercicio"
                    onPress={() => saveExercise(ex.id)}
                    style={styles.saveExerciseButton}
                  />
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

      {/* Historial completo de un ejercicio ("Ver más") */}
      <Sheet
        visible={historySheet !== null}
        onClose={() => setHistorySheet(null)}
        title={historySheet?.name ?? ""}
        description={historySheet ? historyLabel(historySheet.history.length) : undefined}
      >
        <View style={{ gap: 6 }}>
          {historySheet?.history.map((h, i) => <HistoryRow key={i} entry={h} />)}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <View style={styles.historyRow}>
      <Text style={styles.historyDate}>{formatShortDate(entry.date)}</Text>
      <Text style={styles.historySets}>{summarizeHistory(entry)}</Text>
    </View>
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
  seeMore: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  setLabel: { width: 54, fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
  // Campos y botones secundarios más bajos que el estándar (48) para que la
  // lista de series sea compacta; sigue siendo cómodo de tocar (≥ 38).
  compactInput: { minHeight: 40, paddingVertical: 6, fontSize: 15 },
  compactButton: { minHeight: 40 },
  // Mínimo recomendado por Apple para un objetivo táctil.
  saveExerciseButton: { minHeight: 44 },
  noteLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.mutedForeground },
  note: {
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: "rgba(43,51,61,0.4)",
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
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
