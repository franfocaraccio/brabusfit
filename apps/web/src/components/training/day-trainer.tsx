"use client";

import { useRouter } from "next/navigation";
import { useReducer, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  buildWorkoutLogs,
  completedCount as countCompleted,
  completeExercise as completeInWorkout,
  hasIncompleteCompleted,
  hasIncompleteRows,
  initialWorkout,
  isWorkoutDirty,
  restoreFromDraft,
  workoutReducer,
  type TrainingExercise,
  type VolumeProgress,
  type WorkoutDraft,
  type WorkoutRow,
} from "@brabus/shared";

import { saveWorkout } from "@/lib/actions/training";

import { ExerciseCard } from "./exercise-card";
import { SaveBar } from "./save-bar";
import {
  DraftDialog,
  FinishedDialog,
  HistoryDialog,
  IncompleteDialog,
  LeaveDialog,
  ProgressDialog,
  UnfinishedDialog,
} from "./trainer-dialogs";
import { TrainerHeader } from "./trainer-header";
import { useLeaveGuard } from "./use-leave-guard";
import { localStore, useWorkoutBackup } from "./use-workout-backup";
import { useWorkoutClock } from "./use-workout-clock";

export type ExerciseState = TrainingExercise;

const newKey = () => crypto.randomUUID();

/** Confirmación pendiente por series incompletas. */
type IncompleteCheck = { kind: "exercise"; exId: string } | { kind: "session" };

export function DayTrainer({
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
  exercises: ExerciseState[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Todo vive en memoria hasta "Guardar sesión" (con un respaldo local que se
  // ofrece recuperar si la pestaña se cerró de golpe). Cada sesión nueva
  // arranca precargada con las series del último entrenamiento.
  const [workout, dispatch] = useReducer(workoutReducer, exercises, (ex) =>
    initialWorkout(ex, newKey),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  // Ejercicio cuyo historial completo se muestra en el popup "Ver más".
  const [historyDialog, setHistoryDialog] = useState<ExerciseState | null>(
    null,
  );
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  // Pop-ups: series incompletas, progresión y rutina completada.
  const [incomplete, setIncomplete] = useState<IncompleteCheck | null>(null);
  const [progress, setProgress] = useState<{
    name: string;
    data: VolumeProgress;
  } | null>(null);
  const [finished, setFinished] = useState<{ elapsed: number | null } | null>(
    null,
  );
  // "¡Rutina completada!" queda esperando a que se cierre el pop-up de progresión.
  const pendingFinishRef = useRef(false);

  const { completed, rows } = workout;
  const completedCount = countCompleted(workout);
  const allDone = exercises.length > 0 && completedCount === exercises.length;
  const dirty = isWorkoutDirty(workout);

  const { leaveTarget, setLeaveTarget, leave, navigate } = useLeaveGuard(dirty);

  // Respaldo local (borrador + cronómetro) por si se cierra la pestaña.
  const backup = useWorkoutBackup({ userId, routineId, dayId });
  const clock = useWorkoutClock(localStore, backup.timerId);

  const restoreDraft = (draft: WorkoutDraft) => {
    dispatch({
      type: "restore",
      restore: restoreFromDraft(draft, exercises, newKey),
    });
    backup.dismissDraft();
  };

  const discardDraft = () => {
    backup.clear();
    clock.reset();
    backup.dismissDraft();
  };

  const setCompleted = (next: Record<string, boolean>) => {
    dispatch({ type: "setCompleted", completed: next });
    backup.persist(workout, next);
  };

  // Serie hecha: la marca y arranca el descanso que fijó el coach.
  const toggleSetDone = (ex: ExerciseState, row: WorkoutRow) => {
    const done = !row.done;
    dispatch({
      type: "setRow",
      exerciseId: ex.id,
      key: row.key,
      patch: { done },
    });
    if (done) clock.startRest(ex);
  };

  /** Marca el ejercicio como hecho y encadena progresión / rutina completada. */
  const completeExercise = (ex: ExerciseState) => {
    const result = completeInWorkout(exercises, workout, ex);
    setCompleted(result.completed);
    setOpenId(null);

    if (result.progress) {
      pendingFinishRef.current = result.allDone;
      setProgress({ name: ex.name, data: result.progress });
    } else if (result.allDone) {
      setFinished({ elapsed: clock.elapsed() });
    }
  };

  // "Guardar ejercicio": si hay series a medio cargar, primero se confirma.
  const handleDone = (ex: ExerciseState) => {
    if (hasIncompleteRows(rows[ex.id])) {
      setIncomplete({ kind: "exercise", exId: ex.id });
      return;
    }
    completeExercise(ex);
  };

  // Tocar el círculo: completa (o descompleta) sin abrir el ejercicio. Se
  // guardan las series tal como estén (precargadas o editadas).
  const toggleQuickDone = (ex: ExerciseState) => {
    if (completed[ex.id]) {
      setCompleted({ ...completed, [ex.id]: false });
      return;
    }
    handleDone(ex);
  };

  const closeProgress = () => {
    setProgress(null);
    if (pendingFinishRef.current) {
      pendingFinishRef.current = false;
      setFinished({ elapsed: clock.elapsed() });
    }
  };

  const doClose = () => {
    const logs = buildWorkoutLogs(exercises, workout);
    const startedAt = clock.startedAt;

    startTransition(async () => {
      const res = await saveWorkout(
        routineId,
        dayId,
        logs,
        startedAt === null ? null : new Date(startedAt).toISOString(),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      backup.clear();
      setShowCloseWarning(false);
      setFinished(null);
      toast.success("Sesión guardada");
      leave(`/rutinas/${routineId}`);
      router.refresh();
    });
  };

  // "Guardar sesión": series incompletas → ejercicios sin terminar → guardar.
  const checkUnfinished = () => {
    if (allDone) doClose();
    else setShowCloseWarning(true);
  };

  const handleCloseClick = () => {
    if (hasIncompleteCompleted(exercises, workout)) {
      setIncomplete({ kind: "session" });
      return;
    }
    checkUnfinished();
  };

  const confirmIncomplete = () => {
    const check = incomplete;
    setIncomplete(null);
    if (!check) return;
    if (check.kind === "session") {
      checkUnfinished();
      return;
    }
    const ex = exercises.find((e) => e.id === check.exId);
    if (ex) completeExercise(ex);
  };

  return (
    <div className="space-y-5">
      <TrainerHeader
        dayName={dayName}
        completedCount={completedCount}
        total={exercises.length}
        startedAt={clock.startedAt}
        now={clock.now}
        onBack={() => navigate(`/rutinas/${routineId}`)}
        onStart={clock.start}
      />

      <div className="space-y-3">
        {exercises.map((ex) => {
          const isOpen = openId === ex.id;
          return (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              isOpen={isOpen}
              isDone={completed[ex.id]}
              rows={rows[ex.id]}
              variant={workout.variants[ex.id] ?? null}
              note={workout.notes[ex.id] ?? ""}
              pending={pending}
              dispatch={dispatch}
              newKey={newKey}
              onToggleOpen={() => setOpenId(isOpen ? null : ex.id)}
              onQuickDone={() => toggleQuickDone(ex)}
              onSetDone={(row) => toggleSetDone(ex, row)}
              onShowAllHistory={() => setHistoryDialog(ex)}
              onSave={() => handleDone(ex)}
            />
          );
        })}
      </div>

      <SaveBar
        rest={clock.rest}
        restLeft={clock.restLeft}
        completedCount={completedCount}
        pending={pending}
        onAdjustRest={clock.adjustRest}
        onSkipRest={clock.skipRest}
        onSave={handleCloseClick}
      />

      <UnfinishedDialog
        open={showCloseWarning}
        total={exercises.length}
        done={completedCount}
        pending={pending}
        onClose={() => setShowCloseWarning(false)}
        onConfirm={doClose}
      />
      <IncompleteDialog
        open={incomplete !== null}
        onClose={() => setIncomplete(null)}
        onConfirm={confirmIncomplete}
      />
      <ProgressDialog progress={progress} onClose={closeProgress} />
      <FinishedDialog
        finished={finished}
        pending={pending}
        onClose={() => setFinished(null)}
        onSave={doClose}
      />
      <LeaveDialog
        open={leaveTarget !== null}
        onClose={() => setLeaveTarget(null)}
        onLeave={() => {
          const target = leaveTarget;
          setLeaveTarget(null);
          // Salida a propósito: el respaldo y el cronómetro ya no hacen falta.
          backup.clear();
          if (target) leave(target);
        }}
      />
      <DraftDialog
        draft={backup.pendingDraft}
        onDiscard={discardDraft}
        onRestore={restoreDraft}
      />
      <HistoryDialog
        exercise={historyDialog}
        onClose={() => setHistoryDialog(null)}
      />
    </div>
  );
}
