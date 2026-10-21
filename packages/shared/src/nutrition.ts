import { parseDecimal } from "./decimal";

/**
 * Hoy solo los coaches arman y editan planes. Si en el futuro el alumno puede
 * armar o editar los suyos, se habilita acá (y en save_full_plan de la base).
 */
export const STUDENTS_CAN_EDIT_PLANS = false;

/** Alimento tal como se carga en el formulario (strings; vacío = sin dato). */
export type PlanItemInput = {
  food: string;
  amount: string;
  unit: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};
export type PlanOptionInput = { items: PlanItemInput[] };
export type PlanMealInput = { name: string; time_label: string; options: PlanOptionInput[] };

/** Datos para crear o editar un plan completo (RPC save_full_plan). */
export type PlanInput = {
  name: string;
  /** Plantillas: carpeta (o carpeta nueva). Planes de cliente: sin carpeta. */
  folder_id: string | null;
  newFolderName?: string | null;
  /** Solo al crear: ficha del cliente. */
  client_id?: string | null;
  guidelines: string;
  target_kcal: string;
  target_protein: string;
  target_carbs: string;
  target_fat: string;
  target_water_l: string;
  meals: PlanMealInput[];
};

export const MEAL_SUGGESTIONS = [
  "Desayuno",
  "Media mañana",
  "Almuerzo",
  "Merienda",
  "Pre-entreno",
  "Post-entreno",
  "Cena",
  "Colación",
];

export const FOOD_UNITS = [
  "g",
  "ml",
  "unidad",
  "unidades",
  "taza",
  "cda",
  "cdita",
  "porción",
  "rebanada",
  "puñado",
  "a gusto",
];

export const emptyItem = (): PlanItemInput => ({
  food: "",
  amount: "",
  unit: "g",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
});
export const emptyMeal = (name = ""): PlanMealInput => ({
  name,
  time_label: "",
  options: [{ items: [emptyItem()] }],
});

/** "Opción A", "Opción B"… */
export const optionLabel = (i: number) => `Opción ${String.fromCharCode(65 + i)}`;

const isBlankItem = (i: PlanItemInput) => !i.food.trim();

/** Quita alimentos vacíos y normaliza decimales antes de guardar. */
export function normalizePlan(input: PlanInput): PlanInput {
  const num = (s: string) => s.trim().replace(",", ".");
  return {
    ...input,
    name: input.name.trim(),
    guidelines: input.guidelines.trim(),
    target_kcal: num(input.target_kcal),
    target_protein: num(input.target_protein),
    target_carbs: num(input.target_carbs),
    target_fat: num(input.target_fat),
    target_water_l: num(input.target_water_l),
    meals: input.meals.map((m) => ({
      name: m.name.trim(),
      time_label: m.time_label.trim(),
      options: m.options
        .map((o) => ({
          items: o.items
            .filter((i) => !isBlankItem(i))
            .map((i) => ({
              food: i.food.trim(),
              amount: i.amount.trim(),
              unit: i.amount.trim() || i.unit === "a gusto" ? i.unit : "",
              kcal: num(i.kcal),
              protein: num(i.protein),
              carbs: num(i.carbs),
              fat: num(i.fat),
            })),
        }))
        .filter((o) => o.items.length > 0),
    }))
      // Las comidas que quedaron sin alimentos no se guardan.
      .filter((m) => m.options.length > 0),
  };
}

/** Mensaje de error del plan, o null si es válido. */
export function validatePlan(input: PlanInput): string | null {
  if (!input.name.trim()) return "El plan necesita un nombre.";
  // Las comidas sin alimentos se descartan al guardar (normalizePlan).
  const filled = input.meals.filter((m) => m.options.some((o) => o.items.some((i) => !isBlankItem(i))));
  if (filled.length === 0) return "Agregá al menos una comida con un alimento.";
  if (filled.some((m) => !m.name.trim())) return "Cada comida necesita un nombre.";
  return null;
}

// ---------------------------------------------------------------------------
// Totales (kcal y macros)
// ---------------------------------------------------------------------------

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
/** Rango: si las opciones de una comida difieren, el total va de min a max. */
export type MacroRange = { min: Macros; max: Macros; hasData: boolean };

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
const KEYS = ["kcal", "protein", "carbs", "fat"] as const;

type MacroSource = {
  kcal: number | string | null;
  protein: number | string | null;
  carbs: number | string | null;
  fat: number | string | null;
};
const val = (v: number | string | null) => (typeof v === "number" ? v : (parseDecimal(v) ?? 0));
const hasAny = (i: MacroSource) => KEYS.some((k) => i[k] !== null && i[k] !== "");

/** Suma de una opción. */
export function optionTotals(items: MacroSource[]): Macros & { hasData: boolean } {
  const t = { ...ZERO };
  for (const i of items) for (const k of KEYS) t[k] += val(i[k]);
  return { ...t, hasData: items.some(hasAny) };
}

/** Rango de una comida entre sus opciones. */
export function mealRange(options: { items: MacroSource[] }[]): MacroRange {
  const totals = options.map((o) => optionTotals(o.items));
  if (totals.length === 0) return { min: { ...ZERO }, max: { ...ZERO }, hasData: false };
  const min = { ...ZERO };
  const max = { ...ZERO };
  for (const k of KEYS) {
    min[k] = Math.min(...totals.map((t) => t[k]));
    max[k] = Math.max(...totals.map((t) => t[k]));
  }
  return { min, max, hasData: totals.some((t) => t.hasData) };
}

/** Total del día: suma de los rangos de cada comida. */
export function dayRange(meals: { options: { items: MacroSource[] }[] }[]): MacroRange {
  const min = { ...ZERO };
  const max = { ...ZERO };
  let hasData = false;
  for (const m of meals) {
    const r = mealRange(m.options);
    hasData ||= r.hasData;
    for (const k of KEYS) {
      min[k] += r.min[k];
      max[k] += r.max[k];
    }
  }
  return { min, max, hasData };
}

const fmt = (n: number) =>
  Math.round(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });

/** "1.850" o "1.850–1.950" (+ unidad). */
export function formatRange(r: MacroRange, key: keyof Macros, unit = ""): string {
  const a = fmt(r.min[key]);
  const b = fmt(r.max[key]);
  return `${a === b ? a : `${a}–${b}`}${unit ? ` ${unit}` : ""}`;
}

/** Línea corta de macros: "620 kcal · P 40 g · C 70 g · G 18 g". */
export function macroLine(r: MacroRange): string {
  return [
    formatRange(r, "kcal", "kcal"),
    `P ${formatRange(r, "protein", "g")}`,
    `C ${formatRange(r, "carbs", "g")}`,
    `G ${formatRange(r, "fat", "g")}`,
  ].join(" · ");
}

/** Cantidad legible: "60 g", "2 unidades", "a gusto". */
export function itemAmount(i: { amount: string | null; unit: string | null }): string {
  if (!i.amount) return i.unit === "a gusto" ? "a gusto" : "";
  return [i.amount.replace(".", ","), i.unit].filter(Boolean).join(" ");
}

/** Objetivos cargados: [["Calorías", "2.800 kcal"], …]. */
export function planTargets(p: {
  target_kcal: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  target_water_l: number | null;
}): [string, string][] {
  const out: [string, string][] = [];
  const n = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  if (p.target_kcal !== null) out.push(["Calorías", `${n(p.target_kcal)} kcal`]);
  if (p.target_protein !== null) out.push(["Proteínas", `${n(p.target_protein)} g`]);
  if (p.target_carbs !== null) out.push(["Carbohidratos", `${n(p.target_carbs)} g`]);
  if (p.target_fat !== null) out.push(["Grasas", `${n(p.target_fat)} g`]);
  if (p.target_water_l !== null) out.push(["Agua", `${n(p.target_water_l)} L`]);
  return out;
}
