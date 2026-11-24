import { describe, expect, it } from "vitest";

import { emptyItem, type PlanInput } from "./nutrition";
import {
  buildPlanPayload,
  DEFAULT_PLAN_MEALS,
  draftPlanItem,
  draftPlanMeal,
  draftPlanOption,
  findPlanItem,
  initialPlanMeals,
  initialPlanTargets,
  nextMealName,
  optionLetter,
  planIsForClient,
  planMealsReducer,
  planTargetHint,
  type PlanMealDraft,
} from "./plan-draft";
import { NEW_FOLDER, ROUTINE_TEMPLATE } from "./routine-draft";

const keys = () => {
  let n = 0;
  return () => `k${++n}`;
};

const initial: PlanInput = {
  name: "Plan",
  folder_id: "f1",
  guidelines: "Agua",
  target_kcal: "2000",
  target_protein: "",
  target_carbs: "",
  target_fat: "",
  target_water_l: "3",
  meals: [
    {
      name: "Almuerzo",
      time_label: "13:00",
      options: [
        { items: [{ ...emptyItem(), food: "Arroz", amount: "100" }] },
        { items: [{ ...emptyItem(), food: "Fideos" }] },
      ],
    },
  ],
};

describe("arranque", () => {
  it("un plan nuevo trae las 4 comidas de siempre, vacías", () => {
    const meals = initialPlanMeals(undefined, keys());
    expect(meals.map((m) => m.name)).toEqual(DEFAULT_PLAN_MEALS);
    expect(meals[0]).toEqual({
      key: "k1",
      name: "Desayuno",
      time_label: "",
      options: [{ key: "k2", items: [{ ...emptyItem(), key: "k3" }] }],
    });
  });

  it("al editar copia comidas, opciones y alimentos con keys nuevas", () => {
    const meals = initialPlanMeals(initial, keys());
    expect(meals).toHaveLength(1);
    expect(meals[0].name).toBe("Almuerzo");
    expect(meals[0].options.map((o) => o.items.map((i) => i.food))).toEqual([
      ["Arroz"],
      ["Fideos"],
    ]);
    const allKeys = [
      meals[0].key,
      ...meals[0].options.flatMap((o) => [o.key, ...o.items.map((i) => i.key)]),
    ];
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  it("objetivos: los del plan o vacíos", () => {
    expect(initialPlanTargets(initial)).toEqual({
      target_kcal: "2000",
      target_protein: "",
      target_carbs: "",
      target_fat: "",
      target_water_l: "3",
    });
    expect(Object.values(initialPlanTargets())).toEqual(["", "", "", "", ""]);
  });

  it("sugerencia de comida y letras de opción", () => {
    expect(nextMealName([{ name: "Desayuno" }])).toBe("Media mañana");
    expect(
      nextMealName(
        [
          "Desayuno",
          "Media mañana",
          "Almuerzo",
          "Merienda",
          "Pre-entreno",
          "Post-entreno",
          "Cena",
          "Colación",
        ].map((name) => ({ name })),
      ),
    ).toBe("");
    expect(optionLetter(0)).toBe("A");
    expect(optionLetter(2)).toBe("C");
  });
});

describe("planMealsReducer", () => {
  const start = (): PlanMealDraft[] => [
    {
      key: "m1",
      name: "Desayuno",
      time_label: "",
      options: [
        {
          key: "o1",
          items: [
            { ...emptyItem(), key: "i1", food: "Avena" },
            { ...emptyItem(), key: "i2", food: "Banana" },
          ],
        },
      ],
    },
  ];

  it("comidas: agregar, renombrar, horario y quitar", () => {
    let s = planMealsReducer(start(), {
      type: "addMeal",
      meal: draftPlanMeal(() => "m2", "Cena"),
    });
    s = planMealsReducer(s, {
      type: "updateMeal",
      mealKey: "m1",
      patch: { name: "Desayuno temprano", time_label: "7:00" },
    });
    expect(s.map((m) => `${m.name}@${m.time_label}`)).toEqual([
      "Desayuno temprano@7:00",
      "Cena@",
    ]);
    s = planMealsReducer(s, { type: "removeMeal", mealKey: "m1" });
    expect(s.map((m) => m.key)).toEqual(["m2"]);
  });

  it("opciones: agregar y quitar", () => {
    let s = planMealsReducer(start(), {
      type: "addOption",
      mealKey: "m1",
      option: draftPlanOption(() => "o2"),
    });
    expect(s[0].options.map((o) => o.key)).toEqual(["o1", "o2"]);
    s = planMealsReducer(s, {
      type: "removeOption",
      mealKey: "m1",
      optKey: "o1",
    });
    expect(s[0].options.map((o) => o.key)).toEqual(["o2"]);
  });

  it("alimentos: agregar, editar y quitar (el último queda vacío)", () => {
    let s = planMealsReducer(start(), {
      type: "addItem",
      mealKey: "m1",
      optKey: "o1",
      item: draftPlanItem(() => "i3"),
    });
    s = planMealsReducer(s, {
      type: "updateItem",
      mealKey: "m1",
      optKey: "o1",
      itemKey: "i3",
      patch: { food: "Miel", unit: "cda" },
    });
    expect(findPlanItem(s, "m1", "o1", "i3")).toMatchObject({
      food: "Miel",
      unit: "cda",
    });
    const blank = draftPlanItem(() => "blank");
    for (const itemKey of ["i1", "i2", "i3"])
      s = planMealsReducer(s, {
        type: "removeItem",
        mealKey: "m1",
        optKey: "o1",
        itemKey,
        blank,
      });
    expect(s[0].options[0].items).toEqual([blank]);
    expect(findPlanItem(s, "m1", "o1", "nope")).toBeUndefined();
  });
});

describe("buildPlanPayload", () => {
  const meals = initialPlanMeals(initial, keys());
  const base = {
    name: " Plan ",
    isEdit: false,
    forClient: true,
    target: "c1",
    folderId: null,
    newFolderName: "",
    guidelines: " Agua ",
    targets: initialPlanTargets(initial),
    meals,
  };

  it("manda lo cargado sin normalizar y sin keys", () => {
    const r = buildPlanPayload(base);
    expect(r).toEqual({
      ok: true,
      payload: {
        name: " Plan ",
        folder_id: null,
        newFolderName: null,
        client_id: "c1",
        guidelines: " Agua ",
        target_kcal: "2000",
        target_protein: "",
        target_carbs: "",
        target_fat: "",
        target_water_l: "3",
        meals: initial.meals,
      },
    });
  });

  it("plantilla: carpeta existente, nueva o error", () => {
    const tpl = { ...base, forClient: false, target: ROUTINE_TEMPLATE };
    expect(buildPlanPayload({ ...tpl, folderId: "f1" })).toMatchObject({
      ok: true,
      payload: { folder_id: "f1", newFolderName: null, client_id: null },
    });
    expect(
      buildPlanPayload({
        ...tpl,
        folderId: NEW_FOLDER,
        newFolderName: " Volumen ",
      }),
    ).toMatchObject({
      ok: true,
      payload: { folder_id: null, newFolderName: "Volumen" },
    });
    expect(buildPlanPayload({ ...tpl, folderId: NEW_FOLDER })).toEqual({
      ok: false,
      error: "Poné un nombre para la carpeta nueva.",
    });
    expect(buildPlanPayload(tpl)).toEqual({
      ok: false,
      error: "Elegí o creá una carpeta para guardar la plantilla.",
    });
  });

  it("al editar no manda cliente", () => {
    const r = buildPlanPayload({ ...base, isEdit: true });
    expect(r.ok && r.payload.client_id).toBeNull();
  });
});

describe("destino", () => {
  it("es de cliente según el plan (editar) o el destino (crear)", () => {
    expect(planIsForClient(true, "Ana", ROUTINE_TEMPLATE)).toBe(true);
    expect(planIsForClient(true, null, "c1")).toBe(false);
    expect(planIsForClient(false, null, "c1")).toBe(true);
    expect(planIsForClient(false, undefined, ROUTINE_TEMPLATE)).toBe(false);
    expect(planTargetHint(true)).toMatch(/cambiarlo no afecta/);
    expect(planTargetHint(false)).toMatch(/armarles planes/);
  });
});
