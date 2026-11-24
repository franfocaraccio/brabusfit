"use client";

import { useEffect, useState } from "react";

import {
  clearDraft,
  draftKey,
  loadDraft,
  saveDraft,
  timerKey,
  workoutDraftData,
  type WorkoutDraft,
  type WorkoutState,
} from "@brabus/shared";

export const localStore = () =>
  typeof window === "undefined" ? undefined : window.localStorage;

/**
 * Respaldo local por si se cierra la pestaña de golpe: el borrador de la
 * sesión y el inicio del cronómetro. `pendingDraft` es el borrador que quedó
 * de antes (menos de 24 h) mientras se pregunta si continuarlo.
 */
export function useWorkoutBackup({
  userId,
  routineId,
  dayId,
}: {
  userId: string;
  routineId: string;
  dayId: string;
}) {
  const draftId = draftKey(userId, dayId);
  const timerId = timerKey(userId, dayId);
  const [pendingDraft, setPendingDraft] = useState<WorkoutDraft | null>(null);

  // Al entrar: si quedó una sesión sin guardar, preguntamos.
  useEffect(() => {
    const draft = loadDraft(localStore(), draftId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
    if (draft) setPendingDraft(draft);
  }, [draftId]);

  return {
    timerId,
    pendingDraft,
    dismissDraft: () => setPendingDraft(null),
    /** Guarda el borrador (se llama al guardar/marcar un ejercicio). */
    persist: (workout: WorkoutState, completed: Record<string, boolean>) =>
      saveDraft(
        localStore(),
        draftId,
        workoutDraftData(workout, completed, { routineId, dayId }),
      ),
    /** Borra el borrador y el cronómetro (guardado o salida a propósito). */
    clear() {
      clearDraft(localStore(), draftId);
      clearDraft(localStore(), timerId);
    },
  };
}
