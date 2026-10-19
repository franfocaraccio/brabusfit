import {
  fail,
  findCatalogByName,
  ok,
  type ActionResult,
  type CatalogEntry,
  type MuscleGroup,
} from "@brabus/shared";

import { getUserId, type BrabusClient } from "./client";

/**
 * Catálogo disponible para armar rutinas: el general + los propios del
 * usuario. (RLS también deja ver los propios de otros que aparecen en rutinas
 * compartidas; esos no se ofrecen para elegir.)
 */
export async function getCatalog(
  client: BrabusClient,
  userId: string,
): Promise<CatalogEntry[]> {
  const { data } = await client
    .from("exercise_catalog")
    .select("id, name, muscle_group, owner_id")
    .order("name");
  return ((data ?? []) as CatalogEntry[]).filter(
    (e) => e.owner_id === null || e.owner_id === userId,
  );
}

/** Crea un ejercicio propio (solo lo ve quien lo crea). */
export async function createCatalogEntry(
  client: BrabusClient,
  input: { name: string; muscleGroup: MuscleGroup },
  existing: CatalogEntry[] = [],
): Promise<ActionResult<CatalogEntry>> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return fail("Poné un nombre para el ejercicio.");
  if (findCatalogByName(existing, name)) return fail("Ese ejercicio ya existe en el catálogo.");

  const userId = await getUserId(client);
  if (!userId) return fail("No autenticado.");

  const { data, error } = await client
    .from("exercise_catalog")
    .insert({ name, muscle_group: input.muscleGroup, owner_id: userId })
    .select("id, name, muscle_group, owner_id")
    .single();
  if (error) {
    if (error.code === "23505") return fail("Ese ejercicio ya existe en el catálogo.");
    return fail(error.message);
  }
  return ok(data as CatalogEntry);
}
