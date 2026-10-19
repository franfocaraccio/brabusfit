/** Catálogo de ejercicios: grupos musculares y búsqueda (web y mobile). */

import type { MuscleGroup } from "./database";
import { exerciseKey } from "./progress";

export const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "hombros", label: "Hombros" },
  { value: "biceps", label: "Bíceps" },
  { value: "triceps", label: "Tríceps" },
  { value: "antebrazos", label: "Antebrazos" },
  { value: "cuadriceps", label: "Cuádriceps" },
  { value: "isquiotibiales", label: "Isquiotibiales" },
  { value: "gluteos", label: "Glúteos" },
  { value: "aductores", label: "Aductores" },
  { value: "pantorrillas", label: "Pantorrillas" },
  { value: "core", label: "Abdomen / Core" },
  { value: "full_body", label: "Full body / Cardio" },
  { value: "otros", label: "Otros" },
];

export function muscleGroupLabel(group: MuscleGroup): string {
  return MUSCLE_GROUPS.find((g) => g.value === group)?.label ?? "Otros";
}

export type CatalogEntry = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  owner_id: string | null;
};

/**
 * Filtra el catálogo por texto (sin tildes ni mayúsculas, todas las palabras)
 * y por grupo muscular. Los propios primero, después alfabético.
 */
export function searchCatalog(
  entries: CatalogEntry[],
  query: string,
  group: MuscleGroup | null,
): CatalogEntry[] {
  const words = exerciseKey(query).split(" ").filter(Boolean);
  return entries
    .filter((e) => !group || e.muscle_group === group)
    .filter((e) => {
      const key = exerciseKey(e.name);
      return words.every((w) => key.includes(w));
    })
    .sort((a, b) => {
      if (!!a.owner_id !== !!b.owner_id) return a.owner_id ? -1 : 1;
      return a.name.localeCompare(b.name, "es");
    });
}

/** ¿Ya existe un ejercicio con ese nombre (para no ofrecer "Crear")? */
export function findCatalogByName(entries: CatalogEntry[], name: string): CatalogEntry | null {
  const key = exerciseKey(name);
  return key ? (entries.find((e) => exerciseKey(e.name) === key) ?? null) : null;
}
