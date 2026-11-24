/**
 * Tests de caracterización del editor de planes de nutrición (web): fijan el
 * comportamiento actual antes de mover la lógica a packages/shared.
 * Si uno de estos tests cambia, cambió el comportamiento.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanInput } from "@brabus/shared";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const savePlan = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/nutrition", () => ({ savePlan }));
vi.mock("sonner", () => ({ toast }));

import { PlanBuilder } from "./plan-builder";

const folders = [{ id: "folder-1", name: "Volumen" }];
const clients = [{ id: "client-1", name: "Ana Alumna" }] as Parameters<
  typeof PlanBuilder
>[0]["clients"];

const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });
const click = (name: string | RegExp, index = 0) =>
  fireEvent.click(screen.getAllByRole("button", { name })[index]);
const mealNames = () =>
  screen
    .getAllByPlaceholderText<HTMLInputElement>("Desayuno")
    .map((i) => i.value);
/** Los objetivos no tienen el label asociado al input: se buscan por su celda. */
const targetInput = (label: string) =>
  screen.getByText(label).parentElement!.querySelector("input")!;
const foods = () =>
  screen.getAllByLabelText<HTMLInputElement>("Alimento").map((i) => i.value);

const blankItem = {
  food: "",
  amount: "",
  unit: "g",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
};
const blankMeal = (name: string) => ({
  name,
  time_label: "",
  options: [{ items: [blankItem] }],
});

beforeEach(() => {
  savePlan.mockResolvedValue({ ok: true, data: { id: "plan-new" } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("crear", () => {
  it("arranca con las 4 comidas de siempre y manda lo cargado tal cual", async () => {
    render(
      <PlanBuilder
        folders={folders}
        clients={clients}
        initialClientId="client-1"
      />,
    );
    expect(mealNames()).toEqual(["Desayuno", "Almuerzo", "Merienda", "Cena"]);
    expect(screen.queryByText("Carpeta")).toBeNull();
    expect(
      screen.getByText(
        "Es solo de este cliente: cambiarlo no afecta a nadie más.",
      ),
    ).toBeTruthy();

    type(screen.getByLabelText("Nombre del plan"), "Volumen 2800");
    type(targetInput("Calorías (kcal)"), "2800,5");
    type(targetInput("Agua (L)"), "2.5");
    type(
      screen.getByLabelText("Indicaciones generales (opcional)"),
      "Tomar agua",
    );
    type(screen.getAllByPlaceholderText("8:00")[0], "8:00");
    type(screen.getAllByLabelText("Alimento")[0], "Avena");
    type(screen.getAllByLabelText("Cantidad")[0], "60");
    type(screen.getAllByLabelText("kcal")[0], "230");
    type(screen.getAllByLabelText("P (g)")[0], "8,5");
    fireEvent.change(screen.getAllByLabelText("Unidad")[0], {
      target: { value: "taza" },
    });

    // Totales de la opción y del día.
    expect(screen.getByText(/Total del día:/)).toBeTruthy();

    click("Crear plan");
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/nutricion/plan-new"),
    );
    const payload: PlanInput = {
      name: "Volumen 2800",
      folder_id: null,
      newFolderName: null,
      client_id: "client-1",
      guidelines: "Tomar agua",
      target_kcal: "2800,5",
      target_protein: "",
      target_carbs: "",
      target_fat: "",
      target_water_l: "2.5",
      meals: [
        {
          name: "Desayuno",
          time_label: "8:00",
          options: [
            {
              items: [
                {
                  food: "Avena",
                  amount: "60",
                  unit: "taza",
                  kcal: "230",
                  protein: "8,5",
                  carbs: "",
                  fat: "",
                },
              ],
            },
          ],
        },
        blankMeal("Almuerzo"),
        blankMeal("Merienda"),
        blankMeal("Cena"),
      ],
    };
    expect(savePlan).toHaveBeenCalledWith(null, payload);
    expect(toast.success).toHaveBeenCalledWith("Plan creado");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("plantilla sin carpeta: avisa y no guarda", () => {
    render(<PlanBuilder folders={folders} clients={clients} />);
    expect(screen.getByText("Carpeta")).toBeTruthy();
    expect(
      screen.getByText(
        "Las plantillas no las ve nadie: sirven para armarles planes a tus clientes.",
      ),
    ).toBeTruthy();
    click("Crear plan");
    expect(toast.error).toHaveBeenCalledWith(
      "Elegí o creá una carpeta para guardar la plantilla.",
    );
    expect(savePlan).not.toHaveBeenCalled();
  });

  it("si falla, muestra el error y no navega", async () => {
    savePlan.mockResolvedValue({ ok: false, error: "Falta algo." });
    render(
      <PlanBuilder
        folders={folders}
        clients={clients}
        initialClientId="client-1"
      />,
    );
    click("Crear plan");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falta algo."),
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("comidas, opciones y alimentos", () => {
  it("una comida nueva toma la primera sugerencia sin usar", () => {
    render(<PlanBuilder folders={folders} />);
    click(/Agregar comida/);
    expect(mealNames()).toEqual([
      "Desayuno",
      "Almuerzo",
      "Merienda",
      "Cena",
      "Media mañana",
    ]);
    // Eliminar una comida.
    click("Eliminar comida", 0);
    expect(mealNames()[0]).toBe("Almuerzo");
  });

  it("no deja eliminar la única comida", () => {
    render(
      <PlanBuilder
        folders={folders}
        planId="p"
        initial={{
          name: "x",
          folder_id: "folder-1",
          guidelines: "",
          target_kcal: "",
          target_protein: "",
          target_carbs: "",
          target_fat: "",
          target_water_l: "",
          meals: [blankMeal("Única")],
        }}
      />,
    );
    const btn = screen.getByRole("button", {
      name: "Eliminar comida",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("opciones A/B: se agregan, se rotulan y se quitan", () => {
    render(<PlanBuilder folders={folders} />);
    const card = screen
      .getAllByPlaceholderText("Desayuno")[0]
      .closest("[data-slot=card]") as HTMLElement;
    expect(within(card).queryByText("Opción A")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: /Opción B/ }));
    expect(within(card).getByText("Opción A")).toBeTruthy();
    expect(within(card).getByText("Opción B")).toBeTruthy();
    expect(within(card).getByRole("button", { name: /Opción C/ })).toBeTruthy();
    fireEvent.click(
      within(card).getAllByRole("button", { name: "Quitar opción" })[0],
    );
    expect(within(card).queryByText("Opción A")).toBeNull();
    expect(within(card).getByRole("button", { name: /Opción B/ })).toBeTruthy();
  });

  it("quitar el único alimento lo deja vacío; con más, lo saca", () => {
    render(<PlanBuilder folders={folders} />);
    type(screen.getAllByLabelText("Alimento")[0], "Avena");
    click("Quitar alimento", 0);
    expect(foods()[0]).toBe("");

    type(screen.getAllByLabelText("Alimento")[0], "Avena");
    click(/Alimento/, 0);
    expect(foods().slice(0, 2)).toEqual(["Avena", ""]);
    type(screen.getAllByLabelText("Alimento")[1], "Banana");
    click("Quitar alimento", 0);
    expect(foods()[0]).toBe("Banana");
  });

  it("los macros solo aceptan números con coma o punto", () => {
    render(<PlanBuilder folders={folders} />);
    const kcal = screen.getAllByLabelText<HTMLInputElement>("kcal")[0];
    type(kcal, "12a3,5");
    expect(kcal.value).toBe("123,5");
  });
});

describe("editar", () => {
  const initial: PlanInput = {
    name: "Plan viejo",
    folder_id: "folder-1",
    guidelines: "Nada",
    target_kcal: "2000",
    target_protein: "150",
    target_carbs: "",
    target_fat: "",
    target_water_l: "",
    meals: [
      {
        name: "Almuerzo",
        time_label: "13:00",
        options: [
          {
            items: [
              {
                food: "Arroz",
                amount: "100",
                unit: "porción doble",
                kcal: "350",
                protein: "7",
                carbs: "77",
                fat: "1",
              },
            ],
          },
        ],
      },
    ],
  };

  it("plantilla: precarga, conserva una unidad que no está en la lista y guarda", async () => {
    render(<PlanBuilder folders={folders} planId="plan-1" initial={initial} />);
    expect(screen.queryByText("¿Para quién es?")).toBeNull();
    expect(screen.getAllByLabelText<HTMLSelectElement>("Unidad")[0].value).toBe(
      "porción doble",
    );
    type(screen.getByLabelText("Nombre del plan"), "Plan nuevo");
    click("Guardar cambios");
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/nutricion/plan-new"),
    );
    expect(savePlan).toHaveBeenCalledWith("plan-1", {
      ...initial,
      name: "Plan nuevo",
      newFolderName: null,
      client_id: null,
    });
    expect(toast.success).toHaveBeenCalledWith("Plan actualizado");
  });

  it("plan de un cliente: muestra de quién es y no pide carpeta", async () => {
    render(
      <PlanBuilder
        folders={folders}
        planId="plan-1"
        initial={{ ...initial, folder_id: null }}
        clientName="Ana Alumna"
      />,
    );
    expect(screen.getByText("Ana Alumna")).toBeTruthy();
    expect(screen.queryByText("Carpeta")).toBeNull();
    click("Guardar cambios");
    await waitFor(() => expect(savePlan).toHaveBeenCalled());
    expect(savePlan.mock.calls[0][1]).toMatchObject({
      folder_id: null,
      newFolderName: null,
      client_id: null,
    });
  });
});
