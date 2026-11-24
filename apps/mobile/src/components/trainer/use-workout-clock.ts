import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";

import {
  adjustRest,
  elapsedSince,
  loadTimerStart,
  restSecondsLeft,
  saveTimerStart,
  startRest,
  type RestTimer,
  type TrainingExercise,
} from "@brabus/shared";

import { notify } from "@/lib/confirm";
import { authStorage } from "@/lib/storage";

/**
 * Cronómetro del entrenamiento (desde "Empezar"; sigue si se cierra la app) y
 * cuenta regresiva de descanso entre series.
 */
export function useWorkoutClock(timerId: string) {
  const [startedAt, setStartedAt] = useState<number | null>(() =>
    loadTimerStart(authStorage, timerId),
  );
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<RestTimer | null>(null);

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

  return {
    startedAt,
    now,
    rest,
    restLeft: restSecondsLeft(rest, now),
    start() {
      Haptics.selectionAsync();
      const start = Date.now();
      setStartedAt(start);
      setNow(start);
      saveTimerStart(authStorage, timerId, start);
    },
    reset: () => setStartedAt(null),
    elapsed: () => elapsedSince(startedAt, Date.now()),
    /** Arranca el descanso que fijó el coach (si tiene). */
    startRest(ex: TrainingExercise) {
      const start = Date.now();
      const next = startRest(ex, start);
      if (!next) return;
      setNow(start);
      setRest(next);
    },
    adjustRest: (deltaSeconds: number) =>
      setRest((r) => adjustRest(r, deltaSeconds, Date.now())),
    skipRest: () => setRest(null),
  };
}
