"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  adjustRest,
  elapsedSince,
  loadTimerStart,
  restSecondsLeft,
  saveTimerStart,
  startRest,
  type DraftStorage,
  type RestTimer,
  type TrainingExercise,
} from "@brabus/shared";

/**
 * Cronómetro del entrenamiento (desde "Empezar", sobrevive a recargar la
 * pestaña) y cuenta regresiva de descanso entre series.
 */
export function useWorkoutClock(
  storage: () => DraftStorage | undefined,
  timerId: string,
) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<RestTimer | null>(null);

  // Al entrar: si el cronómetro ya se había empezado, sigue contando.
  useEffect(() => {
    const start = loadTimerStart(storage(), timerId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
    if (start) setStartedAt(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storage es un getter estable
  }, [timerId]);

  // Un tic por segundo mientras corre el cronómetro o un descanso.
  useEffect(() => {
    if (startedAt === null && rest === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, rest]);

  // Fin del descanso: aviso y se cierra la cuenta regresiva.
  useEffect(() => {
    if (rest && now >= rest.endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el descanso vence con el reloj
      setRest(null);
      toast.success("¡Descanso terminado! A la próxima serie.");
    }
  }, [now, rest]);

  return {
    startedAt,
    now,
    rest,
    restLeft: restSecondsLeft(rest, now),
    start() {
      const start = Date.now();
      setStartedAt(start);
      setNow(start);
      saveTimerStart(storage(), timerId, start);
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
