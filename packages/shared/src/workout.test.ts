import { describe, expect, it } from "vitest";

import type { WorkoutDraft } from "./draft";
import type { HistoryEntry, TrainingExercise } from "./training";
import {
  adjustRest,
  buildWorkoutLogs,
  completedCount,
  completeExercise,
  elapsedSince,
  finishedMessage,
  hasIncompleteCompleted,
  initialWorkout,
  isWorkoutDirty,
  progressMessage,
  restoreFromDraft,
  restSecondsLeft,
  rowsSignature,
  startRest,
  parseReps,
  unfinishedMessage,
  workoutDraftData,
  workoutReducer,
  type WorkoutState,
} from "./workout";

const keys = () => {
  let n = 0;
  return () => `k${++n}`;
};

const entry = (
  sets: [number | null, number | null][],
  variant: string | null = null,
): HistoryEntry => ({
  date: "2026-10-19T12:00:00Z",
  note: null,
  variant,
  sets: sets.map(([weight, reps], i) => ({
    set_number: i + 1,
    weight,
    reps,
  })),
});

const squat: TrainingExercise = {
  id: "squat",
  name: "Sentadilla",
  setsReps: "3x10",
  restSeconds: 90,
  history: [
    entry(
      [
        [60.5, 10],
        [60.5, 8],
      ],
      "Barra",
    ),
  ],
};
const plank: TrainingExercise = {
  id: "plank",
  name: "Plancha",
  setsReps: "3x30s",
  restSeconds: null,
  history: [],
};
const exercises = [squat, plank];

const fresh = () => initialWorkout(exercises, keys());

describe("initialWorkout", () => {
  it("precarga las series y la variante del último entrenamiento", () => {
    const s = fresh();
    expect(s.rows.squat).toEqual([
      { key: "k1", weight: "60,5", reps: "10" },
      { key: "k2", weight: "60,5", reps: "8" },
    ]);
    expect(s.variants).toEqual({ squat: "Barra", plank: null });
  });

  it("sin historial arranca con una fila vacía", () => {
    expect(fresh().rows.plank).toEqual([{ key: "k3", weight: "", reps: "" }]);
  });

  it("no queda sucia al empezar", () => {
    const s = fresh();
    expect(completedCount(s)).toBe(0);
    expect(isWorkoutDirty(s)).toBe(false);
  });
});

describe("workoutReducer", () => {
  it("editar una serie la ensucia; volver al mismo valor no", () => {
    const s0 = fresh();
    const s1 = workoutReducer(s0, {
      type: "setRow",
      exerciseId: "squat",
      key: "k1",
      patch: { reps: "12" },
    });
    expect(s1.rows.squat[0].reps).toBe("12");
    expect(isWorkoutDirty(s1)).toBe(true);
    const s2 = workoutReducer(s1, {
      type: "setRow",
      exerciseId: "squat",
      key: "k1",
      patch: { reps: " 10 " },
    });
    expect(isWorkoutDirty(s2)).toBe(false);
  });

  it("marcar una serie como hecha no la ensucia", () => {
    const s = workoutReducer(fresh(), {
      type: "setRow",
      exerciseId: "squat",
      key: "k1",
      patch: { done: true },
    });
    expect(s.rows.squat[0].done).toBe(true);
    expect(isWorkoutDirty(s)).toBe(false);
  });

  it("agrega y quita series, dejando siempre al menos una", () => {
    let s = workoutReducer(fresh(), {
      type: "addRow",
      exerciseId: "plank",
      key: "new",
    });
    expect(s.rows.plank.map((r) => r.key)).toEqual(["k3", "new"]);
    s = workoutReducer(s, {
      type: "removeRow",
      exerciseId: "plank",
      key: "k3",
    });
    expect(s.rows.plank.map((r) => r.key)).toEqual(["new"]);
    const same = workoutReducer(s, {
      type: "removeRow",
      exerciseId: "plank",
      key: "new",
    });
    expect(same).toBe(s);
  });

  it("un detalle con texto ensucia; uno en blanco no", () => {
    const blank = workoutReducer(fresh(), {
      type: "setNote",
      exerciseId: "squat",
      note: "   ",
    });
    expect(isWorkoutDirty(blank)).toBe(false);
    const note = workoutReducer(blank, {
      type: "setNote",
      exerciseId: "squat",
      note: "agarre cerrado",
    });
    expect(note.notes.squat).toBe("agarre cerrado");
    expect(isWorkoutDirty(note)).toBe(true);
  });

  it("la variante se elige y se desmarca tocándola de nuevo", () => {
    let s = workoutReducer(fresh(), {
      type: "toggleVariant",
      exerciseId: "plank",
      variant: "Polea",
    });
    expect(s.variants.plank).toBe("Polea");
    s = workoutReducer(s, {
      type: "toggleVariant",
      exerciseId: "plank",
      variant: "Polea",
    });
    expect(s.variants.plank).toBeNull();
  });

  it("completar ensucia y cuenta", () => {
    const s = workoutReducer(fresh(), {
      type: "setCompleted",
      completed: { squat: true, plank: false },
    });
    expect(completedCount(s)).toBe(1);
    expect(isWorkoutDirty(s)).toBe(true);
  });
});

describe("borrador", () => {
  const draft: WorkoutDraft = {
    v: 1,
    savedAt: "2026-10-19T18:40:00Z",
    routineId: "r1",
    dayId: "d1",
    completed: ["squat", "gone"],
    rows: {
      squat: [{ weight: "70", reps: "6" }],
      plank: [],
      gone: [{ weight: "1", reps: "1" }],
    },
    notes: { squat: "pesado", gone: "x" },
    variants: { squat: "Smith", gone: "Polea" },
  };

  it("restaura solo los ejercicios que siguen en el día", () => {
    const restore = restoreFromDraft(draft, exercises, () => "rk");
    expect(restore).toEqual({
      completed: { squat: true },
      rows: { squat: [{ key: "rk", weight: "70", reps: "6" }] },
      notes: { squat: "pesado" },
      variants: { squat: "Smith" },
    });
    const s = workoutReducer(fresh(), { type: "restore", restore });
    // Las series vacías del borrador no pisan las precargadas.
    expect(s.rows.plank).toEqual([{ key: "k3", weight: "", reps: "" }]);
    expect(s.rows.squat).toEqual([{ key: "rk", weight: "70", reps: "6" }]);
    expect(s.variants).toEqual({ squat: "Smith", plank: null });
    expect(s.completed).toEqual({ squat: true });
  });

  it("un borrador viejo sin variantes conserva las precargadas", () => {
    const restore = restoreFromDraft(
      { ...draft, variants: undefined },
      exercises,
      () => "rk",
    );
    expect(restore.variants).toBeUndefined();
    const s = workoutReducer(fresh(), { type: "restore", restore });
    expect(s.variants).toEqual({ squat: "Barra", plank: null });
  });

  it("arma los datos del borrador sin keys ni 'hecha'", () => {
    const s = workoutReducer(fresh(), {
      type: "setRow",
      exerciseId: "squat",
      key: "k1",
      patch: { done: true },
    });
    expect(
      workoutDraftData(
        s,
        { squat: true, plank: false },
        { routineId: "r1", dayId: "d1" },
      ),
    ).toEqual({
      routineId: "r1",
      dayId: "d1",
      completed: ["squat"],
      rows: {
        squat: [
          { weight: "60,5", reps: "10" },
          { weight: "60,5", reps: "8" },
        ],
        plank: [{ weight: "", reps: "" }],
      },
      notes: {},
      variants: { squat: "Barra", plank: null },
    });
  });
});

describe("guardar", () => {
  const withPlank = (): WorkoutState =>
    workoutReducer(
      workoutReducer(fresh(), {
        type: "setRow",
        exerciseId: "plank",
        key: "k3",
        patch: { reps: "30" },
      }),
      { type: "setNote", exerciseId: "plank", note: "lento" },
    );

  it("arma un log por ejercicio completado", () => {
    const s = workoutReducer(withPlank(), {
      type: "setCompleted",
      completed: { plank: true },
    });
    expect(buildWorkoutLogs(exercises, s)).toEqual([
      {
        exerciseId: "plank",
        note: "lento",
        variant: null,
        sets: [{ set_number: 1, weight: null, reps: 30 }],
      },
    ]);
  });

  it("acepta los completados explícitos (antes de re-renderizar)", () => {
    const logs = buildWorkoutLogs(exercises, withPlank(), { squat: true });
    expect(logs).toEqual([
      {
        exerciseId: "squat",
        note: null,
        variant: "Barra",
        sets: [
          { set_number: 1, weight: 60.5, reps: 10 },
          { set_number: 2, weight: 60.5, reps: 8 },
        ],
      },
    ]);
  });

  it("detecta series incompletas solo en los ejercicios completados", () => {
    const s = fresh(); // plancha sin reps
    expect(hasIncompleteCompleted(exercises, s)).toBe(false);
    const done = workoutReducer(s, {
      type: "setCompleted",
      completed: { plank: true },
    });
    expect(hasIncompleteCompleted(exercises, done)).toBe(true);
  });
});

describe("parseReps", () => {
  it("devuelve enteros (la columna es int) o null", () => {
    expect(parseReps("8")).toBe(8);
    expect(parseReps(" 12 ")).toBe(12);
    expect(parseReps("8.5")).toBe(8);
    expect(parseReps("")).toBeNull();
    expect(parseReps("abc")).toBeNull();
    expect(parseReps("-3")).toBeNull();
  });
});

describe("completeExercise", () => {
  it("informa la progresión de volumen", () => {
    const s = workoutReducer(fresh(), {
      type: "setRow",
      exerciseId: "squat",
      key: "k2",
      patch: { reps: "10" },
    });
    const r = completeExercise(exercises, s, squat);
    expect(r.completed).toEqual({ squat: true });
    expect(r.allDone).toBe(false);
    expect(r.progress).toEqual({ before: 1089, after: 1210, percent: 11 });
  });

  it("sin progresión, con el último ejercicio termina el día", () => {
    const s = workoutReducer(fresh(), {
      type: "setCompleted",
      completed: { squat: true },
    });
    const r = completeExercise(exercises, s, plank);
    expect(r.allDone).toBe(true);
    expect(r.progress).toBeNull();
  });
});

describe("descanso", () => {
  it("arranca solo si el coach fijó descanso", () => {
    expect(startRest(squat, 1000)).toEqual({
      exerciseName: "Sentadilla",
      endsAt: 91_000,
    });
    expect(startRest(plank, 1000)).toBeNull();
  });

  it("se ajusta ±15 s y termina si se queda sin tiempo", () => {
    const rest = { exerciseName: "x", endsAt: 20_000 };
    expect(adjustRest(rest, 15, 0)).toEqual({
      exerciseName: "x",
      endsAt: 35_000,
    });
    expect(adjustRest(rest, -15, 4_000)).toEqual({
      exerciseName: "x",
      endsAt: 5_000,
    });
    expect(adjustRest(rest, -15, 5_000)).toBeNull();
    expect(adjustRest(null, 15, 0)).toBeNull();
  });

  it("cuenta los segundos que faltan redondeando hacia arriba", () => {
    const rest = { exerciseName: "x", endsAt: 10_000 };
    expect(restSecondsLeft(rest, 8_500)).toBe(2);
    expect(restSecondsLeft(rest, 12_000)).toBe(0);
    expect(restSecondsLeft(null, 0)).toBe(0);
  });

  it("mide el tiempo desde 'Empezar'", () => {
    expect(elapsedSince(null, 5000)).toBeNull();
    expect(elapsedSince(1000, 5000)).toBe(4000);
  });
});

describe("textos", () => {
  it("progresión, rutina completada y ejercicios sin terminar", () => {
    expect(
      progressMessage("Sentadilla", { before: 1000, after: 1200, percent: 20 }),
    ).toBe(
      "Sentadilla: +20% de volumen respecto a la última vez (1.000 → 1.200 kg).",
    );
    expect(finishedMessage(65_000)).toBe(
      "Tiempo total de entrenamiento: 1:05.",
    );
    expect(finishedMessage(null)).toBe(
      "Completaste todos los ejercicios del día.",
    );
    expect(unfinishedMessage(5, 2)).toBe(
      "Te quedan 3 ejercicios sin guardar. Se registran solo los 2 que guardaste. ¿Querés guardar la sesión igualmente?",
    );
    expect(unfinishedMessage(2, 1)).toBe(
      "Te queda 1 ejercicio sin guardar. Se registra solo el que guardaste. ¿Querés guardar la sesión igualmente?",
    );
  });

  it("la firma ignora espacios", () => {
    expect(rowsSignature([{ key: "a", weight: " 5 ", reps: "3" }])).toBe("5|3");
  });
});
