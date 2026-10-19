"use server";

import type { ActionResult, CatalogEntry, MuscleGroup } from "@brabus/shared";
import * as db from "@brabus/supabase";

import { createClient } from "@/lib/supabase/server";

/** Crea un ejercicio propio en el catálogo (solo lo ve quien lo crea). */
export async function createCatalogEntry(input: {
  name: string;
  muscleGroup: MuscleGroup;
}): Promise<ActionResult<CatalogEntry>> {
  return db.createCatalogEntry(await createClient(), input);
}
