/**
 * Tests de caracterización del entrenador del día (web): fijan el
 * comportamiento actual antes de mover la lógica a packages/shared.
 * Si uno de estos tests cambia, cambió el comportamiento.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { draftKey, timerKey, type TrainingExercise } from "@brabus/shared";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const saveWorkout = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/training", () => ({ saveWorkout }));
vi.mock("sonner", () => ({ toast }));

import { DayTrainer } from "./day-trainer";

const USER = "user-1";
const ROUTINE = "routine-1";
const DAY = "day-1";

const bench: TrainingExercise = {
  id: "ex-bench",
  name: "Press banca",
  setsReps: "3x10",
  restSeconds: null,
  history: [
    {
      date: "2026-10-14T21:00:00Z",
      sets: [
        { set_number: 1, weight: 62.5, reps: 10 },
        { set_number: 2, weight: 62.5, reps: 8 },
      ],
      note: null,
      variant: "Barra",
    },
  ],
};

const pullups: TrainingExercise = {
  id: "ex-pullups",
  name: "Dominadas",
  setsReps: "3xAL FALLO",
  restSeconds: 60,
  history: [],
};

function renderTrainer(exercises: TrainingExercise[] = [bench, pullups]) {
  return render(
    <DayTrainer
      userId={USER}
      routineId={ROUTINE}
      dayId={DAY}
      dayName="Día 1"
      exercises={exercises}
    />,
  );
}

const counter = () => screen.getByText(/ejercicios completados/).textContent;
const openExercise = (name: string) => fireEvent.click(screen.getByText(name));
const weightInputs = () => screen.getAllByPlaceholderText("Peso") as HTMLInputElement[];
const repsInputs = () => screen.getAllByPlaceholderText("Reps") as HTMLInputElement[];
const quickDone = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Marcar ${name} como completado` }));
const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
  localStorage.clear();
  saveWorkout.mockResolvedValue({ ok: true, data: undefined });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("precarga de la última sesión", () => {
  it("arranca con las series y la variante del último entrenamiento", () => {
    renderTrainer();
    // El resumen de la última vez se ve sin abrir el ejercicio.
    expect(screen.getByText("Barra · 62,5kg × 10 · 62,5kg × 8")).toBeTruthy();

    openExercise("Press banca");
    expect(weightInputs().map((i) => i.value)).toEqual(["62,5", "62,5"]);
    expect(repsInputs().map((i) => i.value)).toEqual(["10", "8"]);
    expect(screen.getByRole("radio", { name: "Barra" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByText(/Precargado con tu entrenamiento del/)).toBeTruthy();
  });

  it("sin historial arranca con una serie vacía y sin variante", () => {
    renderTrainer();
    openExercise("Dominadas");
    expect(weightInputs().map((i) => i.value)).toEqual([""]);
    expect(repsInputs().map((i) => i.value)).toEqual([""]);
    expect(
      screen.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false"),
    ).toBe(true);
    // Con una sola serie no se puede quitar.
    expect((screen.getByRole("button", { name: "Quitar serie" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe("completar rápido (círculo)", () => {
  it("marca y desmarca sin abrir el ejercicio", () => {
    renderTrainer();
    expect(counter()).toBe("0 de 2 ejercicios completados");
    expect((screen.getByRole("button", { name: "Guardar sesión" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    quickDone("Press banca");
    expect(counter()).toBe("1 de 2 ejercicios completados");
    expect((screen.getByRole("button", { name: "Guardar sesión" }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Press banca" }));
    expect(counter()).toBe("0 de 2 ejercicios completados");
  });

  it("guarda un respaldo local con lo marcado", () => {
    renderTrainer();
    quickDone("Press banca");
    const draft = JSON.parse(localStorage.getItem(draftKey(USER, DAY))!);
    expect(draft).toMatchObject({
      v: 1,
      routineId: ROUTINE,
      dayId: DAY,
      completed: ["ex-bench"],
      rows: {
        "ex-bench": [
          { weight: "62,5", reps: "10" },
          { weight: "62,5", reps: "8" },
        ],
        "ex-pullups": [{ weight: "", reps: "" }],
      },
      variants: { "ex-bench": "Barra", "ex-pullups": null },
    });

    // Al desmarcar todo, el respaldo se borra.
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Press banca" }));
    expect(localStorage.getItem(draftKey(USER, DAY))).toBeNull();
  });

  it("con series a medio cargar pide confirmación", () => {
    renderTrainer();
    quickDone("Dominadas");
    expect(screen.getByText("⚠️ Faltan datos en algunas series")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(counter()).toBe("0 de 2 ejercicios completados");

    quickDone("Dominadas");
    fireEvent.click(screen.getByRole("button", { name: "Guardar igual" }));
    expect(counter()).toBe("1 de 2 ejercicios completados");
  });
});

describe("guardar la sesión", () => {
  it("al completar todo ofrece guardar y manda las series parseadas", async () => {
    renderTrainer();
    openExercise("Dominadas");
    fireEvent.change(repsInputs()[0], { target: { value: "12" } });
    fireEvent.click(screen.getByRole("radio", { name: "Polea" }));
    fireEvent.change(screen.getByLabelText("Detalle (opcional)"), {
      target: { value: "Con banda" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ejercicio" }));
    quickDone("Press banca");

    expect(within(dialog()).getByText("🎉 ¡Rutina completada!")).toBeTruthy();
    expect(within(dialog()).getByText("Completaste todos los ejercicios del día.")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar entrenamiento" }));
    });

    expect(saveWorkout).toHaveBeenCalledWith(
      ROUTINE,
      DAY,
      [
        {
          exerciseId: "ex-bench",
          note: null,
          variant: "Barra",
          sets: [
            { set_number: 1, weight: 62.5, reps: 10 },
            { set_number: 2, weight: 62.5, reps: 8 },
          ],
        },
        {
          exerciseId: "ex-pullups",
          note: "Con banda",
          variant: "Polea",
          sets: [{ set_number: 1, weight: null, reps: 12 }],
        },
      ],
      null,
    );
    expect(toast.success).toHaveBeenCalledWith("Sesión guardada");
    expect(router.push).toHaveBeenCalledWith(`/rutinas/${ROUTINE}`);
    expect(localStorage.getItem(draftKey(USER, DAY))).toBeNull();
  });

  it("con ejercicios sin hacer avisa y guarda solo los completados", async () => {
    renderTrainer();
    quickDone("Press banca");
    fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
    expect(
      within(dialog()).getByText(
        "Te quedan 1 ejercicios sin guardar. Se registran solo los 1 que guardaste. ¿Querés guardar la sesión igualmente?",
      ),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar igualmente" }));
    });
    expect(saveWorkout).toHaveBeenCalledTimes(1);
    expect(saveWorkout.mock.calls[0][2].map((l: { exerciseId: string }) => l.exerciseId)).toEqual([
      "ex-bench",
    ]);
  });

  it("si falla el guardado muestra el error y no sale", async () => {
    saveWorkout.mockResolvedValue({ ok: false, error: "Sin conexión" });
    renderTrainer([bench]);
    quickDone("Press banca");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar entrenamiento" }));
    });
    expect(toast.error).toHaveBeenCalledWith("Sin conexión");
    expect(router.push).not.toHaveBeenCalled();
    expect(localStorage.getItem(draftKey(USER, DAY))).not.toBeNull();
  });

  it("si subió el volumen muestra la progresión y después la rutina completada", () => {
    renderTrainer([bench]);
    openExercise("Press banca");
    fireEvent.change(repsInputs()[1], { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ejercicio" }));

    expect(within(dialog()).getByText("¡Progresaste!")).toBeTruthy();
    expect(
      within(dialog()).getByText(
        "Press banca: +11% de volumen respecto a la última vez (1.125 → 1.250 kg).",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "¡Vamos!" }));
    expect(within(dialog()).getByText("🎉 ¡Rutina completada!")).toBeTruthy();
  });
});

describe("cronómetro y descanso", () => {
  it("'Empezar' arranca el cronómetro, lo guarda y lo manda al guardar", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T20:00:00Z") });
    renderTrainer([bench]);
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    const timer = screen.getByLabelText("Tiempo de entrenamiento");
    expect(timer.textContent).toBe("0:00");
    expect(localStorage.getItem(timerKey(USER, DAY))).toBe(
      String(new Date("2026-10-21T20:00:00Z").getTime()),
    );

    act(() => vi.advanceTimersByTime(65_000));
    expect(timer.textContent).toBe("1:05");

    quickDone("Press banca");
    expect(
      within(dialog()).getByText("Tiempo total de entrenamiento: 1:05."),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar entrenamiento" }));
    });
    expect(saveWorkout.mock.calls[0][3]).toBe("2026-10-21T20:00:00.000Z");
    expect(localStorage.getItem(timerKey(USER, DAY))).toBeNull();
  });

  it("retoma un cronómetro empezado antes (menos de 24 h)", () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T20:10:00Z") });
    localStorage.setItem(
      timerKey(USER, DAY),
      String(new Date("2026-10-21T20:00:00Z").getTime()),
    );
    renderTrainer([bench]);
    expect(screen.getByLabelText("Tiempo de entrenamiento").textContent).toBe("10:00");
  });

  it("marcar una serie arranca el descanso del coach, ajustable", () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T20:00:00Z") });
    renderTrainer();
    openExercise("Dominadas");
    // Solo los ejercicios con descanso tienen el botón de serie hecha.
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar serie 1 como hecha y descansar" }),
    );
    const rest = screen.getByRole("timer");
    expect(within(rest).getByText("Descanso · Dominadas")).toBeTruthy();
    expect(within(rest).getByText("1:00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "+15 s" }));
    expect(within(rest).getByText("1:15")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "−15 s" }));
    fireEvent.click(screen.getByRole("button", { name: "−15 s" }));
    expect(within(rest).getByText("0:45")).toBeTruthy();

    act(() => vi.advanceTimersByTime(45_000));
    expect(screen.queryByRole("timer")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("¡Descanso terminado! A la próxima serie.");
  });

  it("'Saltar' corta el descanso", () => {
    renderTrainer();
    openExercise("Dominadas");
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar serie 1 como hecha y descansar" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(screen.queryByRole("timer")).toBeNull();
  });
});

describe("cambios sin guardar", () => {
  it("sin cambios, 'Volver' sale directo", () => {
    renderTrainer();
    fireEvent.click(screen.getByText("← Volver a la rutina"));
    expect(router.push).toHaveBeenCalledWith(`/rutinas/${ROUTINE}`);
  });

  it("volver a escribir lo precargado no cuenta como cambio", async () => {
    const user = userEvent.setup();
    renderTrainer();
    openExercise("Press banca");
    await user.clear(weightInputs()[0]);
    await user.type(weightInputs()[0], "62,5");
    fireEvent.click(screen.getByText("← Volver a la rutina"));
    expect(router.push).toHaveBeenCalledWith(`/rutinas/${ROUTINE}`);
  });

  it("con cambios pregunta antes de salir y 'Salir sin guardar' borra el respaldo", () => {
    renderTrainer();
    quickDone("Press banca");
    expect(localStorage.getItem(draftKey(USER, DAY))).not.toBeNull();

    fireEvent.click(screen.getByText("← Volver a la rutina"));
    expect(within(dialog()).getByText("Los cambios no fueron guardados")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Seguir entrenando" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByText("← Volver a la rutina"));
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(router.push).toHaveBeenCalledWith(`/rutinas/${ROUTINE}`);
    expect(localStorage.getItem(draftKey(USER, DAY))).toBeNull();
  });

  it("un detalle escrito también cuenta como cambio", () => {
    renderTrainer();
    openExercise("Dominadas");
    fireEvent.change(screen.getByLabelText("Detalle (opcional)"), {
      target: { value: "Lento" },
    });
    fireEvent.click(screen.getByText("← Volver a la rutina"));
    expect(screen.getByText("Los cambios no fueron guardados")).toBeTruthy();
  });

  it("intercepta los links internos con cambios", () => {
    renderTrainer();
    quickDone("Press banca");
    const link = document.createElement("a");
    link.href = "/progreso";
    link.textContent = "Progreso";
    document.body.appendChild(link);
    fireEvent.click(link);
    expect(screen.getByText("Los cambios no fueron guardados")).toBeTruthy();
    link.remove();
  });
});

describe("respaldo de una sesión sin guardar", () => {
  const saveOldDraft = () =>
    localStorage.setItem(
      draftKey(USER, DAY),
      JSON.stringify({
        v: 1,
        savedAt: new Date().toISOString(),
        routineId: ROUTINE,
        dayId: DAY,
        completed: ["ex-pullups", "ex-borrado"],
        rows: {
          "ex-pullups": [
            { weight: "", reps: "9" },
            { weight: "", reps: "7" },
          ],
        },
        notes: { "ex-pullups": "Con banda" },
        variants: { "ex-pullups": "Polea" },
      }),
    );

  it("ofrece continuarla y restaura lo marcado, series, detalle y variante", () => {
    saveOldDraft();
    renderTrainer();
    expect(within(dialog()).getByText("Tenés una sesión sin guardar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar sesión" }));

    // Los ejercicios que ya no están en la rutina se ignoran.
    expect(counter()).toBe("1 de 2 ejercicios completados");
    openExercise("Dominadas");
    expect(repsInputs().map((i) => i.value)).toEqual(["9", "7"]);
    expect((screen.getByLabelText("Detalle (opcional)") as HTMLTextAreaElement).value).toBe(
      "Con banda",
    );
    expect(screen.getByRole("radio", { name: "Polea" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("'Descartar' lo borra junto con el cronómetro", () => {
    saveOldDraft();
    localStorage.setItem(timerKey(USER, DAY), String(Date.now()));
    renderTrainer();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(localStorage.getItem(draftKey(USER, DAY))).toBeNull();
    expect(localStorage.getItem(timerKey(USER, DAY))).toBeNull();
    expect(counter()).toBe("0 de 2 ejercicios completados");
    expect(screen.getByRole("button", { name: "Empezar" })).toBeTruthy();
  });
});
