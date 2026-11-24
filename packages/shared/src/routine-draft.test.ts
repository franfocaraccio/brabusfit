import { describe, expect, it } from "vitest";

import type { CatalogEntry } from "./catalog";
import {
  buildRoutinePayload,
  emptyRoutineDay,
  emptyRoutineExercise,
  initialRoutineTarget,
  moveItem,
  NEW_FOLDER,
  resolveRoutineFolder,
  restLabel,
  ROUTINE_TEMPLATE,
  routineDaysReducer,
  routineDaysToDrafts,
  routineIsForClient,
  routineTargetHint,
  type RoutineDayDraft,
} from "./routine-draft";

const keys = () => {
  let n = 0;
  return () => `k${++n}`;
};

const squat: CatalogEntry = {
  id: "cat-squat",
  name: "Sentadilla",
  muscle_group: "cuadriceps",
  owner_id: null,
};

const days = (): RoutineDayDraft[] => [
  {
    key: "d1",
    name: "Día 1",
    exercises: [
      { key: "e1", catalog: squat, variant: "", sets_reps: "4x10", rest: 90 },
      { key: "e2", catalog: null, variant: "", sets_reps: "", rest: null },
    ],
  },
  { key: "d2", name: "Día 2", exercises: [] },
];

describe("vacíos", () => {
  it("un día nuevo trae un ejercicio vacío", () => {
    expect(emptyRoutineDay(keys())).toEqual({
      key: "k1",
      name: "",
      exercises: [
        { key: "k2", catalog: null, variant: "", sets_reps: "", rest: null },
      ],
    });
    expect(emptyRoutineExercise(() => "x").key).toBe("x");
  });
});

describe("routineDaysToDrafts", () => {
  it("usa los ids como keys y la variante vacía si no hay", () => {
    expect(
      routineDaysToDrafts([
        {
          id: "day",
          name: "Piernas",
          exercises: [
            {
              id: "ex",
              catalog: squat,
              variant: null,
              sets_reps: "3x8",
              rest_seconds: 60,
            },
          ],
        },
      ]),
    ).toEqual([
      {
        key: "day",
        id: "day",
        name: "Piernas",
        exercises: [
          {
            key: "ex",
            id: "ex",
            catalog: squat,
            variant: "",
            sets_reps: "3x8",
            rest: 60,
          },
        ],
      },
    ]);
  });
});

describe("moveItem", () => {
  it("intercambia con el vecino y no se sale de los bordes", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
    const list = [1, 2];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
  });
});

describe("routineDaysReducer", () => {
  it("agrega, renombra, mueve y quita días", () => {
    let s = routineDaysReducer(days(), {
      type: "addDay",
      day: { key: "d3", name: "", exercises: [] },
    });
    s = routineDaysReducer(s, { type: "renameDay", dayKey: "d3", name: "X" });
    s = routineDaysReducer(s, { type: "moveDay", index: 2, delta: -1 });
    expect(s.map((d) => `${d.key}:${d.name}`)).toEqual([
      "d1:Día 1",
      "d3:X",
      "d2:Día 2",
    ]);
    s = routineDaysReducer(s, { type: "removeDay", dayKey: "d1" });
    expect(s.map((d) => d.key)).toEqual(["d3", "d2"]);
  });

  it("edita, mueve, reordena y quita ejercicios de un día", () => {
    let s = routineDaysReducer(days(), {
      type: "updateExercise",
      dayKey: "d1",
      exKey: "e2",
      patch: { sets_reps: "3x12", rest: 45 },
    });
    expect(s[0].exercises[1]).toMatchObject({ sets_reps: "3x12", rest: 45 });
    s = routineDaysReducer(s, {
      type: "moveExercise",
      dayKey: "d1",
      index: 1,
      delta: -1,
    });
    expect(s[0].exercises.map((e) => e.key)).toEqual(["e2", "e1"]);
    s = routineDaysReducer(s, {
      type: "setExercises",
      dayKey: "d1",
      exercises: [...s[0].exercises].reverse(),
    });
    expect(s[0].exercises.map((e) => e.key)).toEqual(["e1", "e2"]);
    s = routineDaysReducer(s, {
      type: "addExercise",
      dayKey: "d2",
      exercise: emptyRoutineExercise(() => "e3"),
    });
    s = routineDaysReducer(s, {
      type: "removeExercise",
      dayKey: "d1",
      exKey: "e1",
    });
    expect(s.map((d) => d.exercises.map((e) => e.key))).toEqual([
      ["e2"],
      ["e3"],
    ]);
  });

  it("setDays reemplaza el orden (arrastrar en la web)", () => {
    const reordered = [...days()].reverse();
    expect(
      routineDaysReducer(days(), { type: "setDays", days: reordered }),
    ).toBe(reordered);
  });
});

describe("carpeta", () => {
  it("solo se pide para plantillas de coach", () => {
    expect(
      resolveRoutineFolder({
        usesFolder: false,
        folderId: "f",
        newFolderName: "x",
      }),
    ).toEqual({ ok: true, folderId: null, newFolderName: null });
  });

  it("existente, nueva con nombre, o error", () => {
    expect(
      resolveRoutineFolder({
        usesFolder: true,
        folderId: "f1",
        newFolderName: "",
      }),
    ).toEqual({ ok: true, folderId: "f1", newFolderName: null });
    expect(
      resolveRoutineFolder({
        usesFolder: true,
        folderId: NEW_FOLDER,
        newFolderName: "  Fuerza ",
      }),
    ).toEqual({ ok: true, folderId: null, newFolderName: "Fuerza" });
    expect(
      resolveRoutineFolder({
        usesFolder: true,
        folderId: NEW_FOLDER,
        newFolderName: "  ",
      }),
    ).toEqual({ ok: false, error: "Poné un nombre para la carpeta nueva." });
    expect(
      resolveRoutineFolder({
        usesFolder: true,
        folderId: null,
        newFolderName: "",
      }),
    ).toEqual({
      ok: false,
      error: "Elegí o creá una carpeta para guardar la rutina.",
    });
  });
});

describe("buildRoutinePayload", () => {
  const base = {
    name: "  Junio  ",
    days: days(),
    isEdit: false,
    forClient: true,
    target: "client-1",
    usesFolder: false,
    folderId: null,
    newFolderName: "",
  };

  it("arma el payload con textos recortados y el cliente al crear", () => {
    const d = days();
    d[0].exercises[0].variant = "  Barra ";
    d[0].name = " Día 1 ";
    const r = buildRoutinePayload({ ...base, days: d });
    expect(r).toEqual({
      ok: true,
      payload: {
        name: "Junio",
        folderId: null,
        newFolderName: null,
        clientId: "client-1",
        days: [
          {
            id: undefined,
            name: "Día 1",
            exercises: [
              {
                id: undefined,
                catalog_id: "cat-squat",
                variant: "Barra",
                sets_reps: "4x10",
                rest_seconds: 90,
              },
              {
                id: undefined,
                catalog_id: undefined,
                variant: null,
                sets_reps: "",
                rest_seconds: null,
              },
            ],
          },
          { id: undefined, name: "Día 2", exercises: [] },
        ],
      },
    });
  });

  it("al editar no manda cliente", () => {
    const r = buildRoutinePayload({ ...base, isEdit: true });
    expect(r.ok && r.payload.clientId).toBeNull();
  });

  it("devuelve el error de carpeta", () => {
    expect(
      buildRoutinePayload({ ...base, forClient: false, usesFolder: true }),
    ).toEqual({
      ok: false,
      error: "Elegí o creá una carpeta para guardar la rutina.",
    });
  });
});

describe("destino", () => {
  const clients = [{ id: "c1" }];

  it("arranca con el alumno elegido solo si es cliente del coach", () => {
    expect(initialRoutineTarget("c1", clients)).toBe("c1");
    expect(initialRoutineTarget("otro", clients)).toBe(ROUTINE_TEMPLATE);
    expect(initialRoutineTarget(undefined, clients)).toBe(ROUTINE_TEMPLATE);
  });

  it("es de cliente según la rutina (editar) o el destino (crear)", () => {
    expect(routineIsForClient(true, "Ana", ROUTINE_TEMPLATE)).toBe(true);
    expect(routineIsForClient(true, null, "c1")).toBe(false);
    expect(routineIsForClient(false, null, "c1")).toBe(true);
    expect(routineIsForClient(false, null, ROUTINE_TEMPLATE)).toBe(false);
  });

  it("textos", () => {
    expect(restLabel(null)).toBe("Sin descanso");
    expect(restLabel(90)).toBe("Descanso 1:30 min");
    expect(routineTargetHint(true)).toMatch(/solo de este cliente/);
    expect(routineTargetHint(false)).toMatch(/plantillas no las ve nadie/);
  });
});
