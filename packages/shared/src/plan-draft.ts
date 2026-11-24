/**
 * Editor de planes de nutrición (web y mobile): comidas, opciones y alimentos
 * tal como se editan en pantalla, y cómo se arma lo que se guarda.
 *
 * Todo es puro: las apps lo usan con `useReducer` y ponen la UI y el guardado.
 * Lo que se manda va "crudo" (strings); normalizePlan/validatePlan lo limpian
 * al guardar.
 */

import {
  emptyItem,
  MEAL_SUGGESTIONS,
  type PlanInput,
  type PlanItemInput,
} from "./nutrition";
import { resolveRoutineFolder, ROUTINE_TEMPLATE } from "./routine-draft";

export type PlanItemDraft = PlanItemInput & { key: string };
export type PlanOptionDraft = { key: string; items: PlanItemDraft[] };
export type PlanMealDraft = {
  key: string;
  name: string;
  time_label: string;
  options: PlanOptionDraft[];
};

/** Comidas con las que arranca un plan nuevo. */
export const DEFAULT_PLAN_MEALS = ["Desayuno", "Almuerzo", "Merienda", "Cena"];

/** Objetivos del plan (strings, vacío = sin objetivo). */
export const PLAN_TARGET_FIELDS = [
  "target_kcal",
  "target_protein",
  "target_carbs",
  "target_fat",
  "target_water_l",
] as const;
export type PlanTargetField = (typeof PLAN_TARGET_FIELDS)[number];
export type PlanTargets = Record<PlanTargetField, string>;

export const initialPlanTargets = (initial?: PlanInput): PlanTargets => ({
  target_kcal: initial?.target_kcal ?? "",
  target_protein: initial?.target_protein ?? "",
  target_carbs: initial?.target_carbs ?? "",
  target_fat: initial?.target_fat ?? "",
  target_water_l: initial?.target_water_l ?? "",
});

/** Letra de la opción n (0 → "A"). */
export const optionLetter = (i: number) => String.fromCharCode(65 + i);

export const draftPlanItem = (
  newKey: () => string,
  item: PlanItemInput = emptyItem(),
): PlanItemDraft => ({ ...item, key: newKey() });

export const draftPlanOption = (
  newKey: () => string,
  items: PlanItemInput[] = [emptyItem()],
): PlanOptionDraft => ({
  key: newKey(),
  items: items.map((i) => draftPlanItem(newKey, i)),
});

export const draftPlanMeal = (
  newKey: () => string,
  name = "",
): PlanMealDraft => ({
  key: newKey(),
  name,
  time_label: "",
  options: [draftPlanOption(newKey)],
});

/** Comidas para editar: las del plan, o las de siempre si es nuevo. */
export function initialPlanMeals(
  initial: PlanInput | undefined,
  newKey: () => string,
): PlanMealDraft[] {
  if (!initial) return DEFAULT_PLAN_MEALS.map((n) => draftPlanMeal(newKey, n));
  return initial.meals.map((m) => ({
    key: newKey(),
    name: m.name,
    time_label: m.time_label,
    options: m.options.map((o) => draftPlanOption(newKey, o.items)),
  }));
}

/** Nombre sugerido para una comida nueva: la primera sugerencia sin usar. */
export function nextMealName(meals: { name: string }[]): string {
  const used = new Set(meals.map((m) => m.name));
  return MEAL_SUGGESTIONS.find((s) => !used.has(s)) ?? "";
}

export type PlanMealsAction =
  | { type: "addMeal"; meal: PlanMealDraft }
  | { type: "removeMeal"; mealKey: string }
  | {
      type: "updateMeal";
      mealKey: string;
      patch: Partial<Pick<PlanMealDraft, "name" | "time_label">>;
    }
  | { type: "addOption"; mealKey: string; option: PlanOptionDraft }
  | { type: "removeOption"; mealKey: string; optKey: string }
  | { type: "addItem"; mealKey: string; optKey: string; item: PlanItemDraft }
  | {
      type: "updateItem";
      mealKey: string;
      optKey: string;
      itemKey: string;
      patch: Partial<PlanItemInput>;
    }
  | {
      type: "removeItem";
      mealKey: string;
      optKey: string;
      itemKey: string;
      /** Si era el único alimento, queda este (vacío) en su lugar. */
      blank: PlanItemDraft;
    };

const mapMeal = (
  meals: PlanMealDraft[],
  mealKey: string,
  fn: (m: PlanMealDraft) => PlanMealDraft,
) => meals.map((m) => (m.key === mealKey ? fn(m) : m));

const mapOption = (
  meals: PlanMealDraft[],
  mealKey: string,
  optKey: string,
  fn: (o: PlanOptionDraft) => PlanOptionDraft,
) =>
  mapMeal(meals, mealKey, (m) => ({
    ...m,
    options: m.options.map((o) => (o.key === optKey ? fn(o) : o)),
  }));

export function planMealsReducer(
  meals: PlanMealDraft[],
  action: PlanMealsAction,
): PlanMealDraft[] {
  switch (action.type) {
    case "addMeal":
      return [...meals, action.meal];
    case "removeMeal":
      return meals.filter((m) => m.key !== action.mealKey);
    case "updateMeal":
      return mapMeal(meals, action.mealKey, (m) => ({ ...m, ...action.patch }));
    case "addOption":
      return mapMeal(meals, action.mealKey, (m) => ({
        ...m,
        options: [...m.options, action.option],
      }));
    case "removeOption":
      return mapMeal(meals, action.mealKey, (m) => ({
        ...m,
        options: m.options.filter((o) => o.key !== action.optKey),
      }));
    case "addItem":
      return mapOption(meals, action.mealKey, action.optKey, (o) => ({
        ...o,
        items: [...o.items, action.item],
      }));
    case "updateItem":
      return mapOption(meals, action.mealKey, action.optKey, (o) => ({
        ...o,
        items: o.items.map((i) =>
          i.key === action.itemKey ? { ...i, ...action.patch } : i,
        ),
      }));
    case "removeItem":
      return mapOption(meals, action.mealKey, action.optKey, (o) => ({
        ...o,
        items:
          o.items.length > 1
            ? o.items.filter((i) => i.key !== action.itemKey)
            : [action.blank],
      }));
  }
}

/** Busca un alimento por sus keys (para el selector de unidad en mobile). */
export function findPlanItem(
  meals: PlanMealDraft[],
  mealKey: string,
  optKey: string,
  itemKey: string,
): PlanItemDraft | undefined {
  return meals
    .find((m) => m.key === mealKey)
    ?.options.find((o) => o.key === optKey)
    ?.items.find((i) => i.key === itemKey);
}

/** Saca la key interna de cada alimento. */
const toItemInput = ({ key: _key, ...item }: PlanItemDraft): PlanItemInput =>
  item;

/** Aclaración bajo "¿Para quién es?". */
export const planTargetHint = (forClient: boolean) =>
  forClient
    ? "Es solo de este cliente: cambiarlo no afecta a nadie más."
    : "Las plantillas no las ve nadie: sirven para armarles planes a tus clientes.";

/** ¿Es el plan de un cliente? Al editar lo dice el plan; al crear, el destino. */
export const planIsForClient = (
  isEdit: boolean,
  clientName: string | null | undefined,
  target: string,
) => (isEdit ? Boolean(clientName) : target !== ROUTINE_TEMPLATE);

/**
 * Lo que se manda al crear/editar (sin normalizar), o el error de carpeta.
 * Las plantillas necesitan carpeta; el cliente solo va al crear.
 */
export function buildPlanPayload(input: {
  name: string;
  isEdit: boolean;
  forClient: boolean;
  /** Destino elegido al crear: ROUTINE_TEMPLATE o el id del cliente. */
  target: string;
  folderId: string | null;
  newFolderName: string;
  guidelines: string;
  targets: PlanTargets;
  meals: PlanMealDraft[];
}): { ok: true; payload: PlanInput } | { ok: false; error: string } {
  const folder = resolveRoutineFolder({
    usesFolder: !input.forClient,
    folderId: input.folderId,
    newFolderName: input.newFolderName,
    missingFolderError: "Elegí o creá una carpeta para guardar la plantilla.",
  });
  if (!folder.ok) return folder;
  return {
    ok: true,
    payload: {
      name: input.name,
      folder_id: folder.folderId,
      newFolderName: folder.newFolderName,
      client_id: !input.isEdit && input.forClient ? input.target : null,
      guidelines: input.guidelines,
      ...input.targets,
      meals: input.meals.map((m) => ({
        name: m.name,
        time_label: m.time_label,
        options: m.options.map((o) => ({ items: o.items.map(toItemInput) })),
      })),
    },
  };
}
