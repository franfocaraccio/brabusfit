import * as Haptics from "expo-haptics";
import { router, Stack, useNavigation, usePreventRemove } from "expo-router";
import { useEffect, useReducer, useState, useTransition } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildWorkoutLogs,
  completedCount as countCompleted,
  completeExercise as completeInWorkout,
  finishedMessage,
  hasIncompleteCompleted,
  hasIncompleteRows,
  historyLabel,
  initialWorkout,
  isWorkoutDirty,
  progressMessage,
  restoreFromDraft,
  timerKey,
  unfinishedMessage,
  workoutReducer,
  type TrainingExercise,
  type WorkoutRow,
} from "@brabus/shared";
import { saveWorkout } from "@brabus/supabase";

import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { makeStyles } from "@/lib/theme";

import { ExerciseCard } from "./exercise-card";
import { HistoryRow } from "./exercise-history";
import { RestBar } from "./rest-bar";
import { TrainerHeader } from "./trainer-header";
import { useWorkoutBackup } from "./use-workout-backup";
import { useWorkoutClock } from "./use-workout-clock";

let keySeq = 0;
const newKey = () => `row-${++keySeq}`;

const INCOMPLETE = {
  title: "⚠️ Faltan datos en algunas series",
  message: "¿Guardar igualmente?",
  cancelText: "Cancelar",
  confirmText: "Guardar igual",
};

/** Entrenador del día: todo en memoria hasta "Guardar sesión". */
export function Trainer({
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
  const styles = useStyles();
  const [saving, startSaving] = useTransition();
  const [workout, dispatch] = useReducer(workoutReducer, exercises, (ex) =>
    initialWorkout(ex, newKey),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  // Ejercicio cuyo historial completo se muestra en el panel "Ver más".
  const [historySheet, setHistorySheet] = useState<TrainingExercise | null>(
    null,
  );
  // Cronómetro del entrenamiento (desde "Empezar"); sigue si se cierra la app.
  const timerId = timerKey(userId, dayId);
  const clock = useWorkoutClock(timerId);

  const { completed, rows } = workout;
  const completedCount = countCompleted(workout);
  const allDone = exercises.length > 0 && completedCount === exercises.length;
  const dirty = isWorkoutDirty(workout);

  // Respaldo local (borrador + cronómetro) por si la app se cierra de golpe.
  const backup = useWorkoutBackup({
    userId,
    routineId,
    dayId,
    onDiscard: clock.reset,
    onRestore: (draft) =>
      dispatch({
        type: "restore",
        restore: restoreFromDraft(draft, exercises, newKey),
      }),
  });

  // Aviso al salir con cambios sin guardar (botón atrás y gesto de swipe).
  // "leaving" apaga el aviso cuando salimos a propósito (después de guardar).
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);

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
        backup.clear();
        navigation.dispatch(data.action);
      },
    });
  });

  // Volver atrás recién cuando el aviso ya está desactivado.
  useEffect(() => {
    if (leaving) router.back();
  }, [leaving]);

  /** Guarda los completados y el borrador local. */
  const setCompleted = (next: Record<string, boolean>) => {
    dispatch({ type: "setCompleted", completed: next });
    backup.persist(workout, next);
  };

  // Serie hecha: la marca y arranca el descanso que fijó el coach.
  const toggleSetDone = (ex: TrainingExercise, row: WorkoutRow) => {
    Haptics.selectionAsync();
    const done = !row.done;
    dispatch({
      type: "setRow",
      exerciseId: ex.id,
      key: row.key,
      patch: { done },
    });
    if (done) clock.startRest(ex);
  };

  // --- completar ejercicios ---------------------------------------------------
  // Recibe los completados ya actualizados (el estado todavía no se re-renderizó).
  const showFinished = (done: Record<string, boolean>) => {
    confirm({
      title: "🎉 ¡Rutina completada!",
      message: finishedMessage(clock.elapsed()),
      cancelText: "Seguir editando",
      confirmText: "Guardar entrenamiento",
      onConfirm: () => doSave(done),
    });
  };

  /** Marca el ejercicio como hecho y encadena progresión / rutina completada. */
  const completeExercise = (ex: TrainingExercise) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const result = completeInWorkout(exercises, workout, ex);
    const next = result.completed;
    setCompleted(next);
    setOpenId(null);

    if (result.progress) {
      notify("🔥 ¡Progresaste!", progressMessage(ex.name, result.progress), {
        buttonText: "¡Vamos!",
        onClose: result.allDone ? () => showFinished(next) : undefined,
      });
    } else if (result.allDone) {
      showFinished(next);
    }
  };

  // "Guardar ejercicio": si hay series a medio cargar, primero se confirma.
  const saveExercise = (ex: TrainingExercise) => {
    if (hasIncompleteRows(rows[ex.id])) {
      confirm({ ...INCOMPLETE, onConfirm: () => completeExercise(ex) });
      return;
    }
    completeExercise(ex);
  };

  // Círculo: completa (con los mismos controles) o descompleta.
  const toggleDone = (ex: TrainingExercise) => {
    if (completed[ex.id]) {
      Haptics.selectionAsync();
      setCompleted({ ...completed, [ex.id]: false });
      return;
    }
    saveExercise(ex);
  };

  // --- guardar sesión ---------------------------------------------------------
  const doSave = (done: Record<string, boolean> = completed) => {
    const logs = buildWorkoutLogs(exercises, workout, done);
    const startedAt = clock.startedAt;

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
      backup.clear();
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
      message: unfinishedMessage(exercises.length, completedCount),
      cancelText: "Seguir entrenando",
      confirmText: "Guardar igualmente",
      onConfirm: () => doSave(),
    });
  };

  // "Guardar sesión": series incompletas → ejercicios sin terminar → guardar.
  const onSavePress = () => {
    if (hasIncompleteCompleted(exercises, workout)) {
      confirm({ ...INCOMPLETE, onConfirm: checkUnfinished });
      return;
    }
    checkUnfinished();
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <Stack.Screen options={{ title: dayName }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <TrainerHeader
          completedCount={completedCount}
          total={exercises.length}
          startedAt={clock.startedAt}
          now={clock.now}
          onStart={clock.start}
        />

        {exercises.map((ex) => {
          const isOpen = openId === ex.id;
          return (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              isOpen={isOpen}
              isDone={!!completed[ex.id]}
              rows={rows[ex.id]}
              variant={workout.variants[ex.id] ?? null}
              note={workout.notes[ex.id] ?? ""}
              dispatch={dispatch}
              newKey={newKey}
              onToggleOpen={() => setOpenId(isOpen ? null : ex.id)}
              onToggleDone={() => toggleDone(ex)}
              onSetDone={(row) => toggleSetDone(ex, row)}
              onShowAllHistory={() => setHistorySheet(ex)}
              onSave={() => saveExercise(ex)}
            />
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {clock.rest ? (
          <RestBar
            rest={clock.rest}
            secondsLeft={clock.restLeft}
            onAdjust={clock.adjustRest}
            onSkip={clock.skipRest}
          />
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

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
}));
