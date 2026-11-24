/**
 * Tests de caracterización del editor de rutinas (web): fijan el
 * comportamiento actual antes de mover la lógica a packages/shared.
 * Si uno de estos tests cambia, cambió el comportamiento.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogEntry } from "@brabus/shared";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const actions = vi.hoisted(() => ({
  createRoutine: vi.fn(),
  updateRoutine: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/routines", () => actions);
vi.mock("sonner", () => ({ toast }));
// El selector real abre un diálogo con buscador; acá alcanza con elegir.
vi.mock("@/components/routines/exercise-picker", () => ({
  ExercisePicker: ({
    value,
    catalog,
    onChange,
  }: {
    value: CatalogEntry | null;
    catalog: CatalogEntry[];
    onChange: (e: CatalogEntry) => void;
  }) => (
    <div>
      <span>{value ? `Elegido: ${value.name}` : "Sin ejercicio"}</span>
      {catalog.map((c) => (
        <button key={c.id} type="button" onClick={() => onChange(c)}>
          Elegir {c.name}
        </button>
      ))}
    </div>
  ),
}));

import { RoutineBuilder, type RoutineBuilderInitial } from "./routine-builder";

const squat: CatalogEntry = {
  id: "cat-squat",
  name: "Sentadilla",
  muscle_group: "cuadriceps",
  owner_id: null,
};
const bench: CatalogEntry = {
  id: "cat-bench",
  name: "Press banca",
  muscle_group: "pecho",
  owner_id: null,
};
const folders = [{ id: "folder-1", name: "Fuerza" }];
const clients = [{ id: "client-1", name: "Ana Alumna" }] as Parameters<
  typeof RoutineBuilder
>[0]["clients"];

const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });
const submit = (name: RegExp | string) =>
  fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  actions.createRoutine.mockResolvedValue({ ok: true, data: { id: "new-id" } });
  actions.updateRoutine.mockResolvedValue({ ok: true, data: { id: "r-1" } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("crear", () => {
  it("rutina para un cliente: arma el payload y va a la rutina nueva", async () => {
    render(
      <RoutineBuilder
        folders={folders}
        catalog={[squat, bench]}
        isCoach
        clients={clients}
        initialClientId="client-1"
      />,
    );
    // Rutina de cliente: no se pide carpeta.
    expect(screen.queryByText("Carpeta")).toBeNull();
    expect(
      screen.getByText(
        "Es solo de este cliente: cambiarla no afecta a nadie más.",
      ),
    ).toBeTruthy();

    type(screen.getByLabelText("Nombre de la rutina"), "  Junio 4 días ");
    type(screen.getByLabelText("Día 1"), " Piernas ");
    fireEvent.click(screen.getByRole("button", { name: "Elegir Sentadilla" }));
    type(screen.getByLabelText("Series y repeticiones"), " 4x10 ");
    type(screen.getByLabelText("Variante"), "  Barra ");

    // Segundo ejercicio y segundo día.
    fireEvent.click(screen.getByRole("button", { name: /Agregar ejercicio/ }));
    expect(screen.getAllByLabelText("Series y repeticiones")).toHaveLength(2);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Elegir Press banca" })[1],
    );
    type(screen.getAllByLabelText("Series y repeticiones")[1], "3x8");
    fireEvent.click(screen.getByRole("button", { name: /Agregar día/ }));
    type(screen.getByLabelText("Día 2"), "Pecho");
    type(screen.getAllByLabelText("Series y repeticiones")[2], "5x5");

    submit("Crear rutina");

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/rutinas/new-id"),
    );
    expect(actions.createRoutine).toHaveBeenCalledWith({
      name: "Junio 4 días",
      folderId: null,
      newFolderName: null,
      clientId: "client-1",
      days: [
        {
          id: undefined,
          name: "Piernas",
          exercises: [
            {
              id: undefined,
              catalog_id: "cat-squat",
              variant: "Barra",
              sets_reps: "4x10",
              rest_seconds: null,
            },
            {
              id: undefined,
              catalog_id: "cat-bench",
              variant: null,
              sets_reps: "3x8",
              rest_seconds: null,
            },
          ],
        },
        {
          id: undefined,
          name: "Pecho",
          exercises: [
            {
              id: undefined,
              catalog_id: undefined,
              variant: null,
              sets_reps: "5x5",
              rest_seconds: null,
            },
          ],
        },
      ],
    });
    expect(toast.success).toHaveBeenCalledWith("Rutina creada");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("plantilla sin carpeta: avisa y no guarda", () => {
    render(
      <RoutineBuilder
        folders={folders}
        catalog={[squat]}
        isCoach
        clients={clients}
      />,
    );
    expect(screen.getByText("Carpeta")).toBeTruthy();
    expect(
      screen.getByText(
        "Las plantillas no las ve nadie: sirven para armarles rutinas a tus clientes.",
      ),
    ).toBeTruthy();
    submit("Crear rutina");
    expect(toast.error).toHaveBeenCalledWith(
      "Elegí o creá una carpeta para guardar la rutina.",
    );
    expect(actions.createRoutine).not.toHaveBeenCalled();
  });

  it("un alumno no elige destino ni carpeta", async () => {
    render(<RoutineBuilder folders={[]} catalog={[squat]} isCoach={false} />);
    expect(screen.queryByText("¿Para quién es?")).toBeNull();
    expect(screen.queryByText("Carpeta")).toBeNull();
    type(screen.getByLabelText("Nombre de la rutina"), "Mía");
    submit("Crear rutina");
    await waitFor(() => expect(actions.createRoutine).toHaveBeenCalled());
    expect(actions.createRoutine.mock.calls[0][0]).toMatchObject({
      name: "Mía",
      folderId: null,
      newFolderName: null,
      clientId: null,
    });
  });

  it("si falla, muestra el error y no navega", async () => {
    actions.createRoutine.mockResolvedValue({
      ok: false,
      error: "Falta algo.",
    });
    render(<RoutineBuilder folders={[]} catalog={[squat]} isCoach={false} />);
    submit("Crear rutina");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falta algo."),
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("días y ejercicios", () => {
  it("no deja borrar el único día ni el único ejercicio; después sí", () => {
    render(<RoutineBuilder folders={[]} catalog={[squat]} isCoach={false} />);
    const removeDay = () =>
      screen.getAllByRole("button", { name: "Eliminar día" });
    const removeEx = () =>
      screen.getAllByRole("button", { name: "Eliminar ejercicio" });
    expect((removeDay()[0] as HTMLButtonElement).disabled).toBe(true);
    expect((removeEx()[0] as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Agregar ejercicio/ }));
    type(screen.getAllByLabelText("Series y repeticiones")[1], "segundo");
    expect((removeEx()[0] as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(removeEx()[0]);
    expect(
      screen
        .getAllByLabelText<HTMLInputElement>("Series y repeticiones")
        .map((i) => i.value),
    ).toEqual(["segundo"]);

    fireEvent.click(screen.getByRole("button", { name: /Agregar día/ }));
    type(screen.getByLabelText("Día 2"), "Otro");
    fireEvent.click(removeDay()[0]);
    expect(screen.getByLabelText<HTMLInputElement>("Día 1").value).toBe("Otro");
    expect(screen.queryByLabelText("Día 2")).toBeNull();
  });
});

describe("editar", () => {
  const initial: RoutineBuilderInitial = {
    id: "r-1",
    name: "Vieja",
    folderId: "folder-1",
    clientName: null,
    days: [
      {
        key: "day-1",
        id: "day-1",
        name: "Piernas",
        exercises: [
          {
            key: "ex-1",
            id: "ex-1",
            catalog: squat,
            variant: "",
            sets_reps: "4x10",
            rest: 90,
          },
        ],
      },
    ],
  };

  it("plantilla: conserva ids y carpeta, y no manda cliente", async () => {
    render(
      <RoutineBuilder
        folders={folders}
        catalog={[squat]}
        isCoach
        initial={initial}
      />,
    );
    expect(screen.queryByText("¿Para quién es?")).toBeNull();
    expect(screen.getByText("Elegido: Sentadilla")).toBeTruthy();
    type(screen.getByLabelText("Nombre de la rutina"), "Nueva");
    submit("Guardar cambios");
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/rutinas/r-1"),
    );
    expect(actions.updateRoutine).toHaveBeenCalledWith("r-1", {
      name: "Nueva",
      folderId: "folder-1",
      newFolderName: null,
      clientId: null,
      days: [
        {
          id: "day-1",
          name: "Piernas",
          exercises: [
            {
              id: "ex-1",
              catalog_id: "cat-squat",
              variant: null,
              sets_reps: "4x10",
              rest_seconds: 90,
            },
          ],
        },
      ],
    });
    expect(toast.success).toHaveBeenCalledWith("Rutina actualizada");
  });

  it("rutina de un cliente: muestra de quién es y no pide carpeta", async () => {
    render(
      <RoutineBuilder
        folders={folders}
        catalog={[squat]}
        isCoach
        initial={{ ...initial, folderId: null, clientName: "Ana Alumna" }}
      />,
    );
    expect(screen.getByText("Ana Alumna")).toBeTruthy();
    expect(screen.queryByText("Carpeta")).toBeNull();
    submit("Guardar cambios");
    await waitFor(() => expect(actions.updateRoutine).toHaveBeenCalled());
    expect(actions.updateRoutine.mock.calls[0][1]).toMatchObject({
      folderId: null,
      clientId: null,
    });
  });
});
