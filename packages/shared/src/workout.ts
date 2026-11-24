/**
 * Estado del entrenamiento del día (web y mobile): series cargadas, ejercicios
 * completados, detalles y variantes, más el descanso entre series.
 *
 * Todo es puro: las apps lo usan con `useReducer` y se encargan de lo propio de
 * cada plataforma (cronómetro, avisos, navegación, guardado).
 */

import { parseDecimal } from "./decimal";
import type { WorkoutDraft } from "./draft";
import {
  formatDuration,
  formatVolume,
  formatWeight,
  hasIncompleteRows,
  parseSetRows,
  volumeProgress,
  type ExerciseLogInput,
  type TrainingExercise,
  type VolumeProgress,
} from "./training";

/** Fila de serie en pantalla. `key` la genera cada plataforma. */
export type WorkoutRow = {
  key: string;
  weight: string;
  reps: string;
  /** Serie marcada como hecha (arranca el descanso). No se guarda. */
  done?: boolean;
};

export type WorkoutState = {
  completed: Record<string, boolean>;
  rows: Record<string, WorkoutRow[]>;
  notes: Record<string, string>;
  variants: Record<string, string | null>;
  /** Firma de las series precargadas, para saber si el usuario cambió algo. */
  baseline: Record<string, string>;
};

export type NewKey = () => string;

/** Firma comparable de las series (ignora espacios y el estado "hecha"). */
export const rowsSignature = (rows: WorkoutRow[]) =>
  rows.map((r) => `${r.weight.trim()}|${r.reps.trim()}`).join(";");

/** Series iniciales: las del último entrenamiento, o una fila vacía. */
export function initialRowsFor(
  ex: TrainingExercise,
  newKey: NewKey,
): WorkoutRow[] {
  const last = ex.history[0];
  if (!last || last.sets.length === 0)
    return [{ key: newKey(), weight: "", reps: "" }];
  return last.sets.map((s) => ({
    key: newKey(),
    weight: s.weight !== null ? formatWeight(s.weight) : "",
    reps: s.reps !== null ? String(s.reps) : "",
  }));
}

/**
 * Sesión nueva: precargada con las series y la variante del último
 * entrenamiento de cada ejercicio.
 */
export function initialWorkout(
  exercises: TrainingExercise[],
  newKey: NewKey,
): WorkoutState {
  const rows = Object.fromEntries(
    exercises.map((e) => [e.id, initialRowsFor(e, newKey)]),
  );
  return {
    completed: {},
    rows,
    notes: {},
    variants: Object.fromEntries(
      exercises.map((e) => [e.id, e.history[0]?.variant ?? null]),
    ),
    baseline: Object.fromEntries(
      Object.entries(rows).map(([id, rs]) => [id, rowsSignature(rs)]),
    ),
  };
}

export const completedCount = (state: WorkoutState) =>
  Object.values(state.completed).filter(Boolean).length;

/** ¿Hay algo que se perdería al salir sin guardar? */
export function isWorkoutDirty(state: WorkoutState): boolean {
  return (
    completedCount(state) > 0 ||
    Object.values(state.notes).some((n) => n.trim() !== "") ||
    Object.entries(state.rows).some(
      ([id, rs]) => rowsSignature(rs) !== state.baseline[id],
    )
  );
}

/** Lo que se restaura de un borrador (series ya con su `key`). */
export type WorkoutRestore = Pick<
  WorkoutState,
  "completed" | "rows" | "notes"
> & { variants?: Record<string, string | null> };

/**
 * Prepara un borrador para restaurarlo: descarta ejercicios que ya no están en
 * el día y le da una `key` a cada serie.
 */
export function restoreFromDraft(
  draft: WorkoutDraft,
  exercises: TrainingExercise[],
  newKey: NewKey,
): WorkoutRestore {
  const ids = new Set(exercises.map((e) => e.id));
  return {
    completed: Object.fromEntries(
      draft.completed.filter((id) => ids.has(id)).map((id) => [id, true]),
    ),
    rows: Object.fromEntries(
      Object.entries(draft.rows)
        .filter(([id, rs]) => ids.has(id) && rs.length > 0)
        .map(([id, rs]) => [id, rs.map((r) => ({ key: newKey(), ...r }))]),
    ),
    notes: Object.fromEntries(
      Object.entries(draft.notes).filter(([id]) => ids.has(id)),
    ),
    variants: draft.variants
      ? Object.fromEntries(
          Object.entries(draft.variants).filter(([id]) => ids.has(id)),
        )
      : undefined,
  };
}

export type WorkoutAction =
  | {
      type: "setRow";
      exerciseId: string;
      key: string;
      patch: Partial<Omit<WorkoutRow, "key">>;
    }
  | { type: "addRow"; exerciseId: string; key: string }
  | { type: "removeRow"; exerciseId: string; key: string }
  | { type: "setNote"; exerciseId: string; note: string }
  | { type: "toggleVariant"; exerciseId: string; variant: string }
  | { type: "setCompleted"; completed: Record<string, boolean> }
  | { type: "restore"; restore: WorkoutRestore };

export function workoutReducer(
  state: WorkoutState,
  action: WorkoutAction,
): WorkoutState {
  switch (action.type) {
    case "setRow":
      return {
        ...state,
        rows: {
          ...state.rows,
          [action.exerciseId]: state.rows[action.exerciseId].map((r) =>
            r.key === action.key ? { ...r, ...action.patch } : r,
          ),
        },
      };
    case "addRow":
      return {
        ...state,
        rows: {
          ...state.rows,
          [action.exerciseId]: [
            ...state.rows[action.exerciseId],
            { key: action.key, weight: "", reps: "" },
          ],
        },
      };
    case "removeRow": {
      // Siempre queda al menos una serie.
      const rows = state.rows[action.exerciseId];
      if (rows.length <= 1) return state;
      return {
        ...state,
        rows: {
          ...state.rows,
          [action.exerciseId]: rows.filter((r) => r.key !== action.key),
        },
      };
    }
    case "setNote":
      return {
        ...state,
        notes: { ...state.notes, [action.exerciseId]: action.note },
      };
    case "toggleVariant": {
      const selected = state.variants[action.exerciseId] === action.variant;
      return {
        ...state,
        variants: {
          ...state.variants,
          [action.exerciseId]: selected ? null : action.variant,
        },
      };
    }
    case "setCompleted":
      return { ...state, completed: action.completed };
    case "restore": {
      const { restore } = action;
      return {
        ...state,
        completed: restore.completed,
        rows: { ...state.rows, ...restore.rows },
        notes: restore.notes,
        variants: restore.variants
          ? { ...state.variants, ...restore.variants }
          : state.variants,
      };
    }
  }
}

/** Datos del borrador local con los completados indicados. */
export function workoutDraftData(
  state: WorkoutState,
  completed: Record<string, boolean>,
  ids: { routineId: string; dayId: string },
): Omit<WorkoutDraft, "v" | "savedAt"> {
  return {
    routineId: ids.routineId,
    dayId: ids.dayId,
    completed: Object.keys(completed).filter((id) => completed[id]),
    rows: Object.fromEntries(
      Object.entries(state.rows).map(([id, rs]) => [
        id,
        rs.map((r) => ({ weight: r.weight, reps: r.reps })),
      ]),
    ),
    notes: state.notes,
    variants: state.variants,
  };
}

/**
 * Repeticiones como entero (la columna es int): "8" → 8, "8.5" → 8,
 * vacío o inválido → null.
 */
export function parseReps(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isNaN(n) || n < 0 ? null : n;
}

/** Registros a guardar: un log por ejercicio completado, con todas sus series. */
export function buildWorkoutLogs(
  exercises: TrainingExercise[],
  state: WorkoutState,
  completed: Record<string, boolean> = state.completed,
): ExerciseLogInput[] {
  return exercises
    .filter((ex) => completed[ex.id])
    .map((ex) => ({
      exerciseId: ex.id,
      note: state.notes[ex.id] ?? null,
      variant: state.variants[ex.id] ?? null,
      sets: state.rows[ex.id].map((r, i) => ({
        set_number: i + 1,
        weight: parseDecimal(r.weight),
        reps: parseReps(r.reps),
      })),
    }));
}

/** ¿Algún ejercicio completado tiene series a medio cargar? */
export function hasIncompleteCompleted(
  exercises: TrainingExercise[],
  state: WorkoutState,
): boolean {
  return exercises.some(
    (ex) => state.completed[ex.id] && hasIncompleteRows(state.rows[ex.id]),
  );
}

/**
 * Resultado de completar un ejercicio: los nuevos completados, si con eso se
 * terminó el día y la progresión de volumen contra la última vez (o null).
 */
export function completeExercise(
  exercises: TrainingExercise[],
  state: WorkoutState,
  ex: TrainingExercise,
): {
  completed: Record<string, boolean>;
  allDone: boolean;
  progress: VolumeProgress | null;
} {
  const completed = { ...state.completed, [ex.id]: true };
  return {
    completed,
    allDone: exercises.every((e) => completed[e.id]),
    progress: volumeProgress(parseSetRows(state.rows[ex.id]), ex.history[0]),
  };
}

// ---------------------------------------------------------------------------
// Cronómetro y descanso
// ---------------------------------------------------------------------------

/** Cuenta regresiva de descanso en curso. */
export type RestTimer = { exerciseName: string; endsAt: number };

/** Tiempo desde "Empezar" (null si no se usó el cronómetro). */
export const elapsedSince = (start: number | null, now: number) =>
  start === null ? null : now - start;

/** Descanso que fijó el coach para el ejercicio (null si no tiene). */
export function startRest(
  ex: Pick<TrainingExercise, "name" | "restSeconds">,
  now: number,
): RestTimer | null {
  return ex.restSeconds
    ? { exerciseName: ex.name, endsAt: now + ex.restSeconds * 1000 }
    : null;
}

/** ±segundos al descanso; si ya no queda tiempo, se termina. */
export function adjustRest(
  rest: RestTimer | null,
  deltaSeconds: number,
  now: number,
): RestTimer | null {
  if (!rest) return rest;
  const endsAt = rest.endsAt + deltaSeconds * 1000;
  return endsAt <= now ? null : { ...rest, endsAt };
}

/** Segundos enteros que faltan (redondeado hacia arriba). */
export const restSecondsLeft = (rest: RestTimer | null, now: number) =>
  rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;

// ---------------------------------------------------------------------------
// Textos de los avisos (iguales en web y mobile)
// ---------------------------------------------------------------------------

export const progressMessage = (name: string, p: VolumeProgress) =>
  `${name}: +${p.percent}% de volumen respecto a la última vez (${formatVolume(p.before)} → ${formatVolume(p.after)} kg).`;

export const finishedMessage = (elapsed: number | null) =>
  elapsed !== null
    ? `Tiempo total de entrenamiento: ${formatDuration(elapsed)}.`
    : "Completaste todos los ejercicios del día.";

export function unfinishedMessage(total: number, done: number): string {
  const left = total - done;
  const pending =
    left === 1
      ? "Te queda 1 ejercicio sin guardar."
      : `Te quedan ${left} ejercicios sin guardar.`;
  const saved =
    done === 1
      ? "Se registra solo el que guardaste."
      : `Se registran solo los ${done} que guardaste.`;
  return `${pending} ${saved} ¿Querés guardar la sesión igualmente?`;
}
