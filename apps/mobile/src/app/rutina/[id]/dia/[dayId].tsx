import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Redirect,
  router,
  Stack,
  useLocalSearchParams,
  useNavigation,
  usePreventRemove,
} from "expo-router";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  clearDraft,
  describeDraft,
  draftKey,
  EXERCISE_VARIANTS,
  formatDuration,
  formatRest,
  formatShortDate,
  formatVolume,
  hasIncompleteRows,
  loadDraft,
  loadTimerStart,
  saveDraft,
  saveTimerStart,
  timerKey,
  HISTORY_PREVIEW,
  historyLabel,
  formatWeight,
  NOTE_MAX_LENGTH,
  parseDecimal,
  parseSetRows,
  sanitizeDecimal,
  summarizeHistory,
  volumeProgress,
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
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type SetRow = { key: string; weight: string; reps: string; done?: boolean };

/** Cuenta regresiva de descanso en curso. */
type Rest = { exerciseName: string; endsAt: number };

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

/** Tiempo desde "Empezar" (null si no se usó el cronómetro). */
const elapsedSince = (start: number | null) =>
  start === null ? null : Date.now() - start;

// ---------------------------------------------------------------------------
// Pantalla: carga los datos y monta el entrenador
// ---------------------------------------------------------------------------

/** El coach no entrena: ve los días desde el detalle de la rutina. */
export default function TrainDayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  if (profile?.is_coach) return <Redirect href={`/rutina/${id}`} />;
  return <TrainDayScreen />;
}

function TrainDayScreen() {
  const colors = useColors();
  const styles = useStyles();
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
        <ActivityIndicator color={colors.primaryText} />
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
  const colors = useColors();
  const styles = useStyles();
  const [saving, startSaving] = useTransition();
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  // Ejercicio cuyo historial completo se muestra en el panel "Ver más".
  const [historySheet, setHistorySheet] = useState<TrainingExercise | null>(
    null,
  );
  const [rows, setRows] = useState<Record<string, SetRow[]>>(() =>
    Object.fromEntries(exercises.map((e) => [e.id, initialRowsFor(e)])),
  );
  const [initialSignatures] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(rows).map(([id, rs]) => [id, rowsSignature(rs)]),
    ),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Variante anotada: arranca con la de la última vez.
  const [variants, setVariants] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      exercises.map((e) => [e.id, e.history[0]?.variant ?? null]),
    ),
  );
  // Cronómetro del entrenamiento (desde "Empezar"); sigue si se cierra la app.
  const timerId = timerKey(userId, dayId);
  const [startedAt, setStartedAt] = useState<number | null>(() =>
    loadTimerStart(authStorage, timerId),
  );
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<Rest | null>(null);

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
      message:
        'Si salís ahora se pierde lo que cargaste. Para guardarlo usá "Guardar sesión".',
      cancelText: "Seguir entrenando",
      confirmText: "Salir sin guardar",
      destructive: true,
      onConfirm: () => {
        // Salida a propósito: el respaldo y el cronómetro ya no hacen falta.
        clearDraft(authStorage, draftId);
        clearDraft(authStorage, timerId);
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
      variants,
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
      onCancel: () => {
        clearDraft(authStorage, draftId);
        clearDraft(authStorage, timerId);
        setStartedAt(null);
      },
      onConfirm: () => {
        setCompleted(
          Object.fromEntries(
            draft.completed.filter((id) => ids.has(id)).map((id) => [id, true]),
          ),
        );
        setRows((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(draft.rows)
              .filter(([id, rs]) => ids.has(id) && rs.length > 0)
              .map(([id, rs]) => [
                id,
                rs.map((r) => ({ key: newKey(), ...r })),
              ]),
          ),
        }));
        setNotes(
          Object.fromEntries(
            Object.entries(draft.notes).filter(([id]) => ids.has(id)),
          ),
        );
        if (draft.variants) {
          setVariants((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(draft.variants ?? {}).filter(([id]) =>
                ids.has(id),
              ),
            ),
          }));
        }
      },
    });
  }, [draftId, timerId, exercises]);

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
        prev[exId].length > 1
          ? prev[exId].filter((r) => r.key !== key)
          : prev[exId],
    }));

  // --- cronómetro y descanso --------------------------------------------------
  // Un tic por segundo mientras corre el cronómetro o un descanso.
  useEffect(() => {
    if (startedAt === null && rest === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, rest]);

  // Fin del descanso: vibración y aviso.
  useEffect(() => {
    if (rest && now >= rest.endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el descanso vence con el reloj
      setRest(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      notify("¡Descanso terminado!", "A la próxima serie.");
    }
  }, [now, rest]);

  const startWorkout = () => {
    Haptics.selectionAsync();
    const start = Date.now();
    setStartedAt(start);
    setNow(start);
    saveTimerStart(authStorage, timerId, start);
  };

  // Serie hecha: la marca y arranca el descanso que fijó el coach.
  const toggleSetDone = (ex: TrainingExercise, row: SetRow) => {
    Haptics.selectionAsync();
    const done = !row.done;
    setRow(ex.id, row.key, { done });
    if (done && ex.restSeconds) {
      const start = Date.now();
      setNow(start);
      setRest({ exerciseName: ex.name, endsAt: start + ex.restSeconds * 1000 });
    }
  };

  const adjustRest = (deltaSeconds: number) =>
    setRest((r) => {
      if (!r) return r;
      const endsAt = r.endsAt + deltaSeconds * 1000;
      return endsAt <= Date.now() ? null : { ...r, endsAt };
    });

  // --- completar ejercicios ---------------------------------------------------
  // Recibe los completados ya actualizados (el estado todavía no se re-renderizó).
  const showFinished = (done: Record<string, boolean>) => {
    const elapsed = elapsedSince(startedAt);
    confirm({
      title: "🎉 ¡Rutina completada!",
      message:
        elapsed !== null
          ? `Tiempo total de entrenamiento: ${formatDuration(elapsed)}.`
          : "Completaste todos los ejercicios del día.",
      cancelText: "Seguir editando",
      confirmText: "Guardar entrenamiento",
      onConfirm: () => doSave(done),
    });
  };

  /** Marca el ejercicio como hecho y encadena progresión / rutina completada. */
  const completeExercise = (ex: TrainingExercise) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = { ...completed, [ex.id]: true };
    setCompleted(next);
    persistDraft(next);
    setOpenId(null);

    const nowAllDone = exercises.every((e) => next[e.id]);
    const gain = volumeProgress(parseSetRows(rows[ex.id]), ex.history[0]);
    if (gain) {
      notify(
        "🔥 ¡Progresaste!",
        `${ex.name}: +${gain.percent}% de volumen respecto a la última vez (${formatVolume(gain.before)} → ${formatVolume(gain.after)} kg).`,
        {
          buttonText: "¡Vamos!",
          onClose: nowAllDone ? () => showFinished(next) : undefined,
        },
      );
    } else if (nowAllDone) {
      showFinished(next);
    }
  };

  // "Guardar ejercicio": si hay series a medio cargar, primero se confirma.
  const saveExercise = (ex: TrainingExercise) => {
    if (hasIncompleteRows(rows[ex.id])) {
      confirm({
        title: "⚠️ Faltan datos en algunas series",
        message: "¿Guardar igualmente?",
        cancelText: "Cancelar",
        confirmText: "Guardar igual",
        onConfirm: () => completeExercise(ex),
      });
      return;
    }
    completeExercise(ex);
  };

  // Círculo: completa (con los mismos controles) o descompleta.
  const toggleDone = (ex: TrainingExercise) => {
    if (completed[ex.id]) {
      Haptics.selectionAsync();
      const next = { ...completed, [ex.id]: false };
      setCompleted(next);
      persistDraft(next);
      return;
    }
    saveExercise(ex);
  };

  // --- guardar sesión ---------------------------------------------------------
  const doSave = (done: Record<string, boolean> = completed) => {
    const logs: ExerciseLogInput[] = exercises
      .filter((ex) => done[ex.id])
      .map((ex) => ({
        exerciseId: ex.id,
        note: notes[ex.id] ?? null,
        variant: variants[ex.id] ?? null,
        sets: rows[ex.id].map((r, i) => ({
          set_number: i + 1,
          weight: parseDecimal(r.weight),
          reps: r.reps.trim() === "" ? null : Number(r.reps),
        })),
      }));

    startSaving(async () => {
      const res = await saveWorkout(
        supabase,
        routineId,
        dayId,
        logs,
        startedAt === null ? null : new Date(startedAt).toISOString(),
      );
      if (!res.ok) {
        notify("No se pudo guardar", res.error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearDraft(authStorage, draftId);
      clearDraft(authStorage, timerId);
      setLeaving(true);
    });
  };

  const checkUnfinished = () => {
    if (allDone) {
      doSave();
      return;
    }
    confirm({
      title: "Todavía no terminaste",
      message: `Te quedan ${exercises.length - completedCount} ejercicios sin guardar. Se registran solo los ${completedCount} que guardaste. ¿Querés guardar la sesión igualmente?`,
      cancelText: "Seguir entrenando",
      confirmText: "Guardar igualmente",
      onConfirm: () => doSave(),
    });
  };

  // "Guardar sesión": series incompletas → ejercicios sin terminar → guardar.
  const onSavePress = () => {
    const anyIncomplete = exercises.some(
      (ex) => completed[ex.id] && hasIncompleteRows(rows[ex.id]),
    );
    if (anyIncomplete) {
      confirm({
        title: "⚠️ Faltan datos en algunas series",
        message: "¿Guardar igualmente?",
        cancelText: "Cancelar",
        confirmText: "Guardar igual",
        onConfirm: checkUnfinished,
      });
      return;
    }
    checkUnfinished();
  };

  const restLeft = rest
    ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
    : 0;

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <Stack.Screen options={{ title: dayName }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.topRow}>
          <Muted style={{ flex: 1 }}>
            {completedCount} de {exercises.length} ejercicios completados
          </Muted>
          {startedAt === null ? (
            <Pressable
              onPress={startWorkout}
              style={({ pressed }) => [
                styles.startButton,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name="play"
                size={14}
                color={colors.primaryForeground}
              />
              <Text style={styles.startText}>Empezar</Text>
            </Pressable>
          ) : (
            <View
              style={styles.timerPill}
              accessibilityLabel="Tiempo de entrenamiento"
            >
              <Ionicons
                name="timer-outline"
                size={16}
                color={colors.primaryText}
              />
              <Text style={styles.timerText}>
                {formatDuration(now - startedAt)}
              </Text>
            </View>
          )}
        </View>

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
                  onPress={() => toggleDone(ex)}
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
                  onPress={() => setOpenId(isOpen ? null : ex.id)}
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
                    <View style={{ gap: 6 }}>
                      <Pressable
                        onPress={() =>
                          setHistoryOpen((h) => ({ ...h, [ex.id]: !h[ex.id] }))
                        }
                        style={styles.historyToggle}
                      >
                        <Ionicons
                          name="time-outline"
                          size={15}
                          color={colors.mutedForeground}
                        />
                        <Text style={styles.historyToggleText}>
                          {historyLabel(ex.history.length)}
                        </Text>
                        <Ionicons
                          name={
                            historyOpen[ex.id] ? "chevron-up" : "chevron-down"
                          }
                          size={15}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                      {historyOpen[ex.id] &&
                        ex.history
                          .slice(0, HISTORY_PREVIEW)
                          .map((h, i) => <HistoryRow key={i} entry={h} />)}
                      {historyOpen[ex.id] &&
                      ex.history.length > HISTORY_PREVIEW ? (
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
                        {formatShortDate(ex.history[0].date)}. Si progresaste,
                        editalo.
                      </Muted>
                    </View>
                  )}

                  <View style={{ gap: 6 }}>
                    <Text style={styles.noteLabel}>Variante</Text>
                    <View style={styles.chips} accessibilityRole="radiogroup">
                      {EXERCISE_VARIANTS.map((v) => {
                        const selected = variants[ex.id] === v;
                        return (
                          <Pressable
                            key={v}
                            onPress={() =>
                              setVariants((prev) => ({
                                ...prev,
                                [ex.id]: selected ? null : v,
                              }))
                            }
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            style={[styles.chip, selected && styles.chipOn]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                selected && styles.chipTextOn,
                              ]}
                            >
                              {v}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {rows[ex.id].map((row, i) => (
                    <View key={row.key} style={styles.setRow}>
                      <Text style={styles.setLabel}>Serie {i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <TextField
                          value={row.weight}
                          onChangeText={(v) =>
                            setRow(ex.id, row.key, {
                              weight: sanitizeDecimal(v),
                            })
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
                          onChangeText={(v) =>
                            setRow(ex.id, row.key, { reps: onlyDigits(v) })
                          }
                          placeholder="Reps"
                          keyboardType="number-pad"
                          style={styles.compactInput}
                        />
                      </View>
                      {ex.restSeconds ? (
                        <Pressable
                          onPress={() => toggleSetDone(ex, row)}
                          hitSlop={6}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: !!row.done }}
                          accessibilityLabel={`Serie ${i + 1} hecha, descansar`}
                          style={[
                            styles.setCheck,
                            row.done && styles.setCheckOn,
                          ]}
                        >
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={
                              row.done
                                ? colors.primaryForeground
                                : colors.mutedForeground
                            }
                          />
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => removeRow(ex.id, row.key)}
                        disabled={rows[ex.id].length === 1}
                        hitSlop={8}
                        accessibilityLabel="Quitar serie"
                        style={{ opacity: rows[ex.id].length === 1 ? 0.3 : 1 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={colors.foreground}
                        />
                      </Pressable>
                    </View>
                  ))}

                  <Button
                    title="Agregar serie"
                    variant="outline"
                    onPress={() => addRow(ex.id)}
                    icon={
                      <Ionicons
                        name="add"
                        size={18}
                        color={colors.foreground}
                      />
                    }
                    style={styles.compactButton}
                  />

                  <View style={{ gap: 6 }}>
                    <Text style={styles.noteLabel}>Detalle (opcional)</Text>
                    {/* Una línea; crece sola si el texto no entra. */}
                    <TextInput
                      value={notes[ex.id] ?? ""}
                      onChangeText={(v) =>
                        setNotes((n) => ({ ...n, [ex.id]: v }))
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
                    onPress={() => saveExercise(ex)}
                    style={styles.saveExerciseButton}
                  />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {rest ? (
          <View
            style={styles.restBar}
            accessibilityRole="timer"
            accessibilityLiveRegion="polite"
          >
            <Ionicons
              name="timer-outline"
              size={22}
              color={colors.primaryText}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.restLabel} numberOfLines={1}>
                Descanso · {rest.exerciseName}
              </Text>
              <Text style={styles.restTime}>
                {formatDuration(restLeft * 1000)}
              </Text>
            </View>
            <Pressable
              onPress={() => adjustRest(-15)}
              style={styles.restButton}
              hitSlop={4}
            >
              <Text style={styles.restButtonText}>−15 s</Text>
            </Pressable>
            <Pressable
              onPress={() => adjustRest(15)}
              style={styles.restButton}
              hitSlop={4}
            >
              <Text style={styles.restButtonText}>+15 s</Text>
            </Pressable>
            <Pressable
              onPress={() => setRest(null)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.restSkip}>Saltar</Text>
            </Pressable>
          </View>
        ) : null}
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
        description={
          historySheet ? historyLabel(historySheet.history.length) : undefined
        }
      >
        <View style={{ gap: 6 }}>
          {historySheet?.history.map((h, i) => (
            <HistoryRow key={i} entry={h} />
          ))}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const styles = useStyles();
  return (
    <View style={styles.historyRow}>
      <Text style={styles.historyDate}>{formatShortDate(entry.date)}</Text>
      <Text style={styles.historySets}>{summarizeHistory(entry)}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  startText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primaryForeground,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.15)",
  },
  timerText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.primaryText,
    fontVariant: ["tabular-nums"],
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
  restBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(249,115,22,0.15)",
  },
  restLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  restTime: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  restButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.input,
  },
  restButtonText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.foreground,
  },
  restSkip: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.mutedForeground,
  },
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
  historyToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyToggleText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  historyRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.subtle,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyDate: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  historySets: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.foreground,
  },
  seeMore: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primaryText,
  },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  setLabel: {
    width: 54,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  // Campos y botones secundarios más bajos que el estándar (48) para que la
  // lista de series sea compacta; sigue siendo cómodo de tocar (≥ 38).
  compactInput: { minHeight: 40, paddingVertical: 6, fontSize: 15 },
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
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
}));
