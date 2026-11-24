import { useEffect, useRef } from "react";

import {
  clearDraft,
  describeDraft,
  draftKey,
  loadDraft,
  saveDraft,
  timerKey,
  workoutDraftData,
  type WorkoutDraft,
  type WorkoutState,
} from "@brabus/shared";

import { confirm } from "@/lib/confirm";
import { authStorage } from "@/lib/storage";

/**
 * Respaldo local por si la app se cierra de golpe: el borrador de la sesión y
 * el inicio del cronómetro. Al entrar, si quedó una sesión sin guardar (menos
 * de 24 h), pregunta una sola vez si continuarla.
 */
export function useWorkoutBackup({
  userId,
  routineId,
  dayId,
  onRestore,
  onDiscard,
}: {
  userId: string;
  routineId: string;
  dayId: string;
  onRestore: (draft: WorkoutDraft) => void;
  onDiscard: () => void;
}) {
  const draftId = draftKey(userId, dayId);
  const timerId = timerKey(userId, dayId);

  const askedDraftRef = useRef(false);
  useEffect(() => {
    if (askedDraftRef.current) return;
    askedDraftRef.current = true;
    const draft = loadDraft(authStorage, draftId);
    if (!draft) return;
    confirm({
      title: "Tenés una sesión sin guardar",
      message: `${describeDraft(draft)} ¿Querés continuarla o empezar de nuevo?`,
      cancelText: "Descartar",
      confirmText: "Continuar sesión",
      onCancel: () => {
        clearDraft(authStorage, draftId);
        clearDraft(authStorage, timerId);
        onDiscard();
      },
      onConfirm: () => onRestore(draft),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se pregunta una sola vez al entrar
  }, [draftId, timerId]);

  return {
    /** Guarda el borrador (al guardar/marcar un ejercicio). */
    persist: (workout: WorkoutState, completed: Record<string, boolean>) =>
      saveDraft(
        authStorage,
        draftId,
        workoutDraftData(workout, completed, { routineId, dayId }),
      ),
    /** Borra el borrador y el cronómetro (guardado o salida a propósito). */
    clear() {
      clearDraft(authStorage, draftId);
      clearDraft(authStorage, timerId);
    },
  };
}
