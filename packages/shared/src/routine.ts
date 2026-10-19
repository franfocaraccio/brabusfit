import type { RoutineDayInput } from "./database";

/** Datos para crear o editar una rutina completa. */
export type RoutinePayload = {
  name: string;
  folderId: string | null;
  /** Si viene, se crea una carpeta nueva con este nombre y se usa para la rutina. */
  newFolderName?: string | null;
  days: RoutineDayInput[];
};

/** Devuelve un mensaje de error si la rutina no es válida, o null. */
export function validateRoutine(payload: RoutinePayload): string | null {
  if (!payload.name.trim()) return "La rutina necesita un nombre.";
  if (payload.days.length === 0) return "Agregá al menos un día.";
  for (const day of payload.days) {
    if (!day.name.trim()) return "Cada día necesita un nombre.";
    for (const ex of day.exercises) {
      if (!ex.catalog_id && !ex.name?.trim()) return "Elegí el ejercicio en cada fila.";
      if (!ex.sets_reps.trim()) return "Cada ejercicio necesita series/repeticiones.";
    }
  }
  return null;
}
