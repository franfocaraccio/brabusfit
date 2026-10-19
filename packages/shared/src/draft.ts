/**
 * Borrador local de una sesión de entrenamiento (respaldo por si la app se
 * cierra de golpe). Vive solo en el dispositivo; nunca va a la base.
 *
 * - Se guarda cada vez que se guarda/marca un ejercicio.
 * - Se borra al "Guardar sesión", al "Salir sin guardar" o si no queda ningún
 *   ejercicio marcado.
 * - Vence a las 24 horas.
 */

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type DraftRow = { weight: string; reps: string };

export type WorkoutDraft = {
  v: 1;
  savedAt: string;
  routineId: string;
  dayId: string;
  /** Ids de los ejercicios marcados como hechos. */
  completed: string[];
  rows: Record<string, DraftRow[]>;
  notes: Record<string, string>;
};

/** Lo mínimo de Storage que necesitamos (localStorage web o expo-sqlite). */
export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function draftKey(userId: string, dayId: string): string {
  return `brabus:workout-draft:${userId}:${dayId}`;
}

/** Lee el borrador; si está vencido o roto lo borra y devuelve null. */
export function loadDraft(
  storage: DraftStorage | undefined,
  key: string,
  now: Date = new Date(),
): WorkoutDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as WorkoutDraft;
    const age = now.getTime() - new Date(draft.savedAt).getTime();
    if (draft.v !== 1 || !(age >= 0 && age < DRAFT_TTL_MS) || draft.completed.length === 0) {
      storage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // sin storage disponible: no hay borrador
    }
    return null;
  }
}

/** Guarda el borrador (o lo borra si no hay ejercicios marcados). */
export function saveDraft(
  storage: DraftStorage | undefined,
  key: string,
  data: Omit<WorkoutDraft, "v" | "savedAt">,
): void {
  if (!storage) return;
  try {
    if (data.completed.length === 0) {
      storage.removeItem(key);
      return;
    }
    const draft: WorkoutDraft = { v: 1, savedAt: new Date().toISOString(), ...data };
    storage.setItem(key, JSON.stringify(draft));
  } catch {
    // Si el almacenamiento falla, el respaldo simplemente no está.
  }
}

export function clearDraft(storage: DraftStorage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // ignorar
  }
}

/** "dom 19/10 a las 18:40 · 3 ejercicios guardados" */
export function describeDraft(draft: WorkoutDraft): string {
  const d = new Date(draft.savedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const weekday = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()];
  const day = `${weekday} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const n = draft.completed.length;
  return `Del ${day} a las ${time} · ${n} ${n === 1 ? "ejercicio guardado" : "ejercicios guardados"}.`;
}
