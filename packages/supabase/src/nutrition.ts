import {
  fail,
  itemAmount,
  normalizePlan,
  ok,
  planTargets,
  validatePlan,
  type ActionResult,
  type AppAccess,
  type NutritionPlan,
  type PlanExport,
  type PlanInput,
} from "@brabus/shared";

import { getUserId, type BrabusClient } from "./client";
import {
  CLIENT_NAME_SELECT,
  clientName,
  fullName,
  getClientOf,
  type ClientNameRow,
  type FolderLite,
  type Person,
} from "./routines";

// ---------------------------------------------------------------------------
// Carpetas de plantillas (propias de nutrición)
// ---------------------------------------------------------------------------

export async function getNutritionFolders(
  client: BrabusClient,
  userId: string,
): Promise<FolderLite[]> {
  const { data } = await client
    .from("nutrition_folders")
    .select("id, name")
    .eq("owner_id", userId)
    .order("name");
  return (data ?? []) as FolderLite[];
}

export async function createNutritionFolder(
  client: BrabusClient,
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("La carpeta necesita un nombre.");
  const userId = await getUserId(client);
  if (!userId) return fail("No autenticado.");
  const { data, error } = await client
    .from("nutrition_folders")
    .insert({ owner_id: userId, name: trimmed })
    .select("id")
    .single();
  if (error) return fail(error.message);
  return ok({ id: data.id });
}

export async function deleteNutritionFolder(
  client: BrabusClient,
  folderId: string,
): Promise<ActionResult> {
  // Los planes de la carpeta pasan a "Sin carpeta" (folder_id = null por FK).
  const { error } = await client.from("nutrition_folders").delete().eq("id", folderId);
  if (error) return fail(error.message);
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Listados
// ---------------------------------------------------------------------------

export type PlanLite = { id: string; name: string; folder_id: string | null };
export type CoachPlanLite = {
  id: string;
  name: string;
  coachName: string | null;
  isCurrent: boolean;
};
export type ClientPlanGroup = {
  clientId: string;
  name: string;
  appAccess: AppAccess;
  archived: boolean;
  plans: { id: string; name: string; isCurrent: boolean }[];
};

/**
 * Lo que muestra la sección Nutrición:
 * - folders / plans: plantillas del coach (o planes propios del alumno).
 * - clients: planes que el coach les armó a sus clientes, agrupados por ficha.
 * - fromCoaches: planes que los coaches le armaron al alumno.
 */
export async function getNutritionOverview(
  client: BrabusClient,
  userId: string,
): Promise<{
  folders: FolderLite[];
  plans: PlanLite[];
  clients: ClientPlanGroup[];
  fromCoaches: CoachPlanLite[];
}> {
  const [folders, ownRes, clientsRes, fromCoachesRes] = await Promise.all([
    getNutritionFolders(client, userId),
    client
      .from("nutrition_plans")
      .select("id, name, folder_id, client_id, is_current")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    client.from("coach_students").select(CLIENT_NAME_SELECT).eq("coach_id", userId),
    // RLS: solo los de coaches con acceso activo.
    client
      .from("nutrition_plans")
      .select("id, name, is_current, owner:profiles!nutrition_plans_owner_id_fkey(first_name, last_name)")
      .neq("owner_id", userId)
      .order("is_current", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const own = ownRes.data ?? [];
  const clients = new Map(
    ((clientsRes.data ?? []) as unknown as ClientNameRow[]).map((c) => [c.id, c]),
  );
  const groups = new Map<string, ClientPlanGroup>();
  for (const p of own) {
    const c = p.client_id ? clients.get(p.client_id) : undefined;
    if (!c) continue;
    let group = groups.get(c.id);
    if (!group) {
      group = {
        clientId: c.id,
        name: clientName(c),
        appAccess: c.status,
        archived: c.archived_at !== null,
        plans: [],
      };
      groups.set(c.id, group);
    }
    group.plans.push({ id: p.id, name: p.name, isCurrent: p.is_current });
  }

  return {
    folders,
    plans: own
      .filter((p) => !p.client_id)
      .map((p) => ({ id: p.id, name: p.name, folder_id: p.folder_id })),
    clients: [...groups.values()].sort(
      (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, "es"),
    ),
    fromCoaches: (
      (fromCoachesRes.data ?? []) as unknown as {
        id: string;
        name: string;
        is_current: boolean;
        owner: Person | null;
      }[]
    ).map((p) => ({ id: p.id, name: p.name, coachName: fullName(p.owner), isCurrent: p.is_current })),
  };
}

/** Planes de un cliente (para su ficha). */
export async function getClientPlans(
  client: BrabusClient,
  clientId: string,
): Promise<{ id: string; name: string; isCurrent: boolean }[]> {
  const { data } = await client
    .from("nutrition_plans")
    .select("id, name, is_current")
    .eq("client_id", clientId)
    .order("is_current", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, isCurrent: p.is_current }));
}

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

export type PlanItem = {
  food: string;
  amount: string | null;
  unit: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};
export type PlanMeal = {
  id: string;
  name: string;
  time_label: string | null;
  options: { items: PlanItem[] }[];
};
export type PlanDetail = {
  plan: NutritionPlan;
  ownerName: string | null;
  /** Cliente del plan (solo para su coach), o null si es plantilla / plan propio. */
  client: { id: string; name: string; appAccess: AppAccess; archived: boolean } | null;
  meals: PlanMeal[];
};

type MealRow = {
  id: string;
  name: string;
  time_label: string | null;
  position: number;
  options: { position: number; items: (PlanItem & { position: number })[] }[];
};

/** Plan completo con comidas, opciones y alimentos. Null si no existe o no hay acceso. */
export async function getPlanDetail(
  client: BrabusClient,
  planId: string,
): Promise<PlanDetail | null> {
  const { data: row } = await client
    .from("nutrition_plans")
    .select("*, owner:profiles!nutrition_plans_owner_id_fkey(first_name, last_name)")
    .eq("id", planId)
    .maybeSingle();
  if (!row) return null;
  const { owner, ...plan } = row as unknown as NutritionPlan & { owner: Person | null };

  const [c, { data: mealsData }] = await Promise.all([
    getClientOf(client, plan.client_id),
    client
      .from("nutrition_meals")
      .select(
        "id, name, time_label, position, options:nutrition_options(position, items:nutrition_items(food, amount, unit, kcal, protein, carbs, fat, position))",
      )
      .eq("plan_id", planId)
      .order("position"),
  ]);

  const byPos = <T extends { position: number }>(list: T[]) =>
    [...list].sort((a, b) => a.position - b.position);

  return {
    plan,
    ownerName: fullName(owner),
    client: c
      ? { id: c.id, name: clientName(c), appAccess: c.status, archived: c.archived_at !== null }
      : null,
    meals: byPos((mealsData ?? []) as unknown as MealRow[]).map((m) => ({
      id: m.id,
      name: m.name,
      time_label: m.time_label,
      options: byPos(m.options).map((o) => ({
        items: byPos(o.items).map((i) => ({
          food: i.food,
          amount: i.amount,
          unit: i.unit,
          kcal: i.kcal,
          protein: i.protein,
          carbs: i.carbs,
          fat: i.fat,
        })),
      })),
    })),
  };
}

const str = (v: number | string | null) =>
  v === null ? "" : String(v).replace(".", ",");

/** Detalle → datos del formulario de edición. */
export function planToInput(d: PlanDetail): PlanInput {
  return {
    name: d.plan.name,
    folder_id: d.plan.folder_id,
    guidelines: d.plan.guidelines ?? "",
    target_kcal: str(d.plan.target_kcal),
    target_protein: str(d.plan.target_protein),
    target_carbs: str(d.plan.target_carbs),
    target_fat: str(d.plan.target_fat),
    target_water_l: str(d.plan.target_water_l),
    meals: d.meals.map((m) => ({
      name: m.name,
      time_label: m.time_label ?? "",
      options: m.options.map((o) => ({
        items: o.items.map((i) => ({
          food: i.food,
          amount: str(i.amount),
          unit: i.unit ?? "",
          kcal: str(i.kcal),
          protein: str(i.protein),
          carbs: str(i.carbs),
          fat: str(i.fat),
        })),
      })),
    })),
  };
}

/** Detalle → datos para PDF / Excel (todo el plan). */
export function planExport(d: PlanDetail): PlanExport {
  return {
    name: d.plan.name,
    clientName: d.client?.name ?? null,
    coachName: d.ownerName,
    date: new Date().toISOString(),
    guidelines: d.plan.guidelines,
    targets: planTargets(d.plan),
    meals: d.meals.map((m) => ({
      name: m.name,
      time: m.time_label,
      options: m.options.map((o) => ({
        items: o.items.map((i) => ({
          food: i.food,
          amount: itemAmount(i),
          kcal: i.kcal,
          protein: i.protein,
          carbs: i.carbs,
          fat: i.fat,
        })),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Cambios
// ---------------------------------------------------------------------------

/** Crea (id null) o actualiza un plan completo. */
export async function savePlan(
  client: BrabusClient,
  planId: string | null,
  input: PlanInput,
): Promise<ActionResult<{ id: string }>> {
  const invalid = validatePlan(input);
  if (invalid) return fail(invalid);
  const data = normalizePlan(input);

  // Plantillas: carpeta existente o nueva. Planes de cliente: sin carpeta.
  let folderId = data.client_id ? null : data.folder_id;
  if (!data.client_id && data.newFolderName?.trim()) {
    const created = await createNutritionFolder(client, data.newFolderName);
    if (!created.ok) return fail(created.error);
    folderId = created.data.id;
  }

  const { data: id, error } = await client.rpc("save_full_plan", {
    p_plan_id: planId,
    p_data: { ...data, folder_id: folderId, newFolderName: null },
  });
  if (error) return fail(error.message);
  return ok({ id: id as string });
}

/** Copia independiente: a un cliente (clientId) o como plantilla nueva. */
export async function copyPlan(
  client: BrabusClient,
  planId: string,
  clientId: string | null,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await client.rpc("copy_nutrition_plan", {
    p_plan_id: planId,
    p_client_id: clientId,
  });
  if (error) return fail(error.message);
  return ok({ id: data as string });
}

/** Marca el plan como vigente para su cliente. */
export async function setCurrentPlan(client: BrabusClient, planId: string): Promise<ActionResult> {
  const { error } = await client.rpc("set_current_plan", { p_plan_id: planId });
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function deletePlan(client: BrabusClient, planId: string): Promise<ActionResult> {
  const { error } = await client.from("nutrition_plans").delete().eq("id", planId);
  if (error) return fail(error.message);
  return ok(undefined);
}
