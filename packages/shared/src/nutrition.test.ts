import { describe, expect, it } from "vitest";

import {
  dayRange,
  emptyItem,
  emptyMeal,
  formatRange,
  itemAmount,
  macroLine,
  mealRange,
  normalizePlan,
  optionLabel,
  optionTotals,
  planTargets,
  validatePlan,
  type PlanInput,
  type PlanItemInput,
} from "./nutrition";

const item = (over: Partial<PlanItemInput>): PlanItemInput => ({
  ...emptyItem(),
  ...over,
});

const plan = (over: Partial<PlanInput> = {}): PlanInput => ({
  name: "Plan base",
  folder_id: null,
  guidelines: "",
  target_kcal: "",
  target_protein: "",
  target_carbs: "",
  target_fat: "",
  target_water_l: "",
  meals: [
    {
      name: "Desayuno",
      time_label: "8:00",
      options: [{ items: [item({ food: "Huevos", amount: "3", unit: "unidades" })] }],
    },
  ],
  ...over,
});

describe("empty values and labels", () => {
  it("creates an empty meal with one option and one item", () => {
    expect(emptyMeal("Cena")).toEqual({
      name: "Cena",
      time_label: "",
      options: [{ items: [emptyItem()] }],
    });
    expect(emptyItem().unit).toBe("g");
  });

  it("labels options with letters", () => {
    expect(optionLabel(0)).toBe("Opción A");
    expect(optionLabel(2)).toBe("Opción C");
  });
});

describe("validatePlan", () => {
  it("accepts a plan with a named meal and a food", () => {
    expect(validatePlan(plan())).toBeNull();
  });

  it("requires a name and at least one food", () => {
    expect(validatePlan(plan({ name: " " }))).toBe("El plan necesita un nombre.");
    expect(validatePlan(plan({ meals: [emptyMeal("Desayuno")] }))).toBe(
      "Agregá al menos una comida con un alimento.",
    );
  });

  it("requires a name only for meals that have food", () => {
    const meals = [
      ...plan().meals,
      { name: "", time_label: "", options: [{ items: [item({ food: "Pan" })] }] },
    ];
    expect(validatePlan(plan({ meals }))).toBe("Cada comida necesita un nombre.");
    expect(validatePlan(plan({ meals: [...plan().meals, emptyMeal("")] }))).toBeNull();
  });
});

describe("normalizePlan", () => {
  it("trims text, converts decimal commas and drops empty items and meals", () => {
    const out = normalizePlan(
      plan({
        name: "  Plan  ",
        target_kcal: " 2800 ",
        target_water_l: "2,5",
        meals: [
          {
            name: " Almuerzo ",
            time_label: " 13:00 ",
            options: [
              {
                items: [
                  item({ food: " Pollo ", amount: " 150 ", kcal: "247,5", protein: "46,5" }),
                  item({ food: "  " }),
                ],
              },
              { items: [item({ food: "" })] },
            ],
          },
          emptyMeal("Cena"),
        ],
      }),
    );
    expect(out.name).toBe("Plan");
    expect(out.target_kcal).toBe("2800");
    expect(out.target_water_l).toBe("2.5");
    expect(out.meals).toEqual([
      {
        name: "Almuerzo",
        time_label: "13:00",
        options: [
          {
            items: [
              {
                food: "Pollo",
                amount: "150",
                unit: "g",
                kcal: "247.5",
                protein: "46.5",
                carbs: "",
                fat: "",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("drops the unit when there is no amount, except 'a gusto'", () => {
    const meals = [
      {
        name: "Cena",
        time_label: "",
        options: [
          {
            items: [
              item({ food: "Sal", unit: "a gusto" }),
              item({ food: "Ensalada", unit: "g" }),
            ],
          },
        ],
      },
    ];
    const units = normalizePlan(plan({ meals })).meals[0].options[0].items.map(
      (i) => i.unit,
    );
    expect(units).toEqual(["a gusto", ""]);
  });
});

describe("totals", () => {
  const optionA = [
    { kcal: "300", protein: "20", carbs: "30", fat: "10" },
    { kcal: 100, protein: null, carbs: "5,5", fat: "" },
  ];
  const optionB = [{ kcal: 500, protein: 40, carbs: 50, fat: 15 }];

  it("adds an option, accepting numbers, text with comma and empty values", () => {
    expect(optionTotals(optionA)).toEqual({
      kcal: 400,
      protein: 20,
      carbs: 35.5,
      fat: 10,
      hasData: true,
    });
    expect(optionTotals([{ kcal: null, protein: "", carbs: null, fat: "" }]).hasData).toBe(
      false,
    );
  });

  it("shows a range when the options of a meal differ", () => {
    const r = mealRange([{ items: optionA }, { items: optionB }]);
    expect(r.min).toEqual({ kcal: 400, protein: 20, carbs: 35.5, fat: 10 });
    expect(r.max).toEqual({ kcal: 500, protein: 40, carbs: 50, fat: 15 });
    expect(formatRange(r, "kcal", "kcal")).toBe("400–500 kcal");
    expect(mealRange([]).hasData).toBe(false);
  });

  it("adds the meal ranges for the day", () => {
    const meal = { options: [{ items: optionA }, { items: optionB }] };
    const day = dayRange([meal, { options: [{ items: optionB }] }]);
    expect(day.min.kcal).toBe(900);
    expect(day.max.kcal).toBe(1000);
    // Se redondea a enteros: 85,5 g de carbohidratos se muestran como 86.
    expect(macroLine(day)).toBe(
      "900–1.000 kcal · P 60–80 g · C 86–100 g · G 25–30 g",
    );
  });

  it("shows a single value when min and max match", () => {
    const r = mealRange([{ items: optionB }]);
    expect(formatRange(r, "protein", "g")).toBe("40 g");
    expect(formatRange(r, "protein")).toBe("40");
  });
});

describe("itemAmount / planTargets", () => {
  it("formats amounts with unit", () => {
    expect(itemAmount({ amount: "150", unit: "g" })).toBe("150 g");
    expect(itemAmount({ amount: "0.5", unit: "taza" })).toBe("0,5 taza");
    expect(itemAmount({ amount: null, unit: "a gusto" })).toBe("a gusto");
    expect(itemAmount({ amount: "", unit: "g" })).toBe("");
  });

  it("lists only the targets that were set", () => {
    expect(
      planTargets({
        target_kcal: 2800,
        target_protein: 180,
        target_carbs: null,
        target_fat: null,
        target_water_l: 2.5,
      }),
    ).toEqual([
      ["Calorías", "2.800 kcal"],
      ["Proteínas", "180 g"],
      ["Agua", "2,5 L"],
    ]);
  });
});
