import { describe, expect, it } from "vitest";

import type { RoutineDayInput } from "./database";
import { validateRoutine, type RoutinePayload } from "./routine";

const payload = (over: Partial<RoutinePayload> = {}): RoutinePayload => ({
  name: "Fuerza",
  folderId: null,
  days: [
    { name: "Día 1", exercises: [{ catalog_id: "cat-1", sets_reps: "4x10" }] },
  ],
  ...over,
});

const day = (exercise: RoutineDayInput["exercises"][number]) => [
  { name: "Día 1", exercises: [exercise] },
];

describe("validateRoutine", () => {
  it("accepts a complete routine", () => {
    expect(validateRoutine(payload())).toBeNull();
  });

  it("requires a name and at least one day", () => {
    expect(validateRoutine(payload({ name: "  " }))).toBe(
      "La rutina necesita un nombre.",
    );
    expect(validateRoutine(payload({ days: [] }))).toBe(
      "Agregá al menos un día.",
    );
  });

  it("requires a name per day", () => {
    expect(validateRoutine(payload({ days: [{ name: " ", exercises: [] }] }))).toBe(
      "Cada día necesita un nombre.",
    );
  });

  it("requires each exercise to be picked and to have sets/reps", () => {
    expect(validateRoutine(payload({ days: day({ name: "", sets_reps: "3x8" }) }))).toBe(
      "Elegí el ejercicio en cada fila.",
    );
    // Sin catálogo pero con nombre (compatibilidad): es válido.
    expect(
      validateRoutine(payload({ days: day({ name: "Remo", sets_reps: "3x8" }) })),
    ).toBeNull();
    expect(
      validateRoutine(payload({ days: day({ catalog_id: "cat-1", sets_reps: " " }) })),
    ).toBe("Cada ejercicio necesita series/repeticiones.");
  });
});
