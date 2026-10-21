"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult, PlanInput } from "@brabus/shared";
import * as db from "@brabus/supabase";

import { createClient } from "@/lib/supabase/server";

// Capa fina sobre @brabus/supabase (compartida con mobile): revalidar caché.

const revalidateNutrition = () => {
  revalidatePath("/nutricion", "layout");
  revalidatePath("/clientes", "layout");
};

export async function savePlan(
  planId: string | null,
  input: PlanInput,
): Promise<ActionResult<{ id: string }>> {
  const result = await db.savePlan(await createClient(), planId, input);
  if (result.ok) revalidateNutrition();
  return result;
}

/** Copia un plan propio a un cliente (o como plantilla nueva si clientId es null). */
export async function copyPlan(
  planId: string,
  clientId: string | null,
): Promise<ActionResult<{ id: string }>> {
  const result = await db.copyPlan(await createClient(), planId, clientId);
  if (result.ok) revalidateNutrition();
  return result;
}

export async function setCurrentPlan(planId: string): Promise<ActionResult> {
  const result = await db.setCurrentPlan(await createClient(), planId);
  if (result.ok) revalidateNutrition();
  return result;
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  const result = await db.deletePlan(await createClient(), planId);
  if (result.ok) revalidateNutrition();
  return result;
}

export async function createNutritionFolder(name: string): Promise<ActionResult> {
  const result = await db.createNutritionFolder(await createClient(), name);
  if (result.ok) revalidatePath("/nutricion");
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function deleteNutritionFolder(folderId: string): Promise<ActionResult> {
  const result = await db.deleteNutritionFolder(await createClient(), folderId);
  if (result.ok) revalidatePath("/nutricion");
  return result;
}
