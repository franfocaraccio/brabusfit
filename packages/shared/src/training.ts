/** Tipos y helpers del entrenamiento, compartidos entre web y mobile. */

import { parseDecimal } from "./decimal";

export type SetInput = {
  set_number: number;
  weight: number | null;
  reps: number | null;
};

export type ExerciseLogInput = {
  exerciseId: string;
  sets: SetInput[];
  note: string | null;
  /** Con qué lo hizo (una de EXERCISE_VARIANTS) o null. */
  variant: string | null;
};

/** Variantes que el alumno puede anotar al registrar un ejercicio. */
export const EXERCISE_VARIANTS = [
  "Barra",
  "Máquina",
  "Polea",
  "Smith",
] as const;
export type ExerciseVariant = (typeof EXERCISE_VARIANTS)[number];

/** Entrenamientos anteriores que se muestran al expandir un ejercicio. */
export const HISTORY_PREVIEW = 3;
/** Máximo de entrenamientos anteriores que se traen por ejercicio ("Ver más"). */
export const HISTORY_MAX = 12;

/** "Último entrenamiento" (1) o "Últimos entrenamientos" (2 o más). */
export function historyLabel(count: number): string {
  return count === 1 ? "Último entrenamiento" : "Últimos entrenamientos";
}

/** Largo máximo del detalle de un ejercicio. */
export const NOTE_MAX_LENGTH = 80;

export type SavedSet = {
  set_number: number;
  weight: number | null;
  reps: number | null;
};

export type HistoryEntry = {
  date: string;
  sets: SavedSet[];
  note: string | null;
  variant: string | null;
};

/** Un ejercicio del día con su historial (últimas sesiones finalizadas). */
export type TrainingExercise = {
  id: string;
  name: string;
  setsReps: string;
  /** Descanso entre series que fijó el coach (null = sin descanso). */
  restSeconds: number | null;
  history: HistoryEntry[];
};

/** Fila de serie tal como se edita en pantalla (texto). */
export type SetRowInput = { weight: string; reps: string };

/** Convierte filas de texto en series (descarta las vacías). */
export function parseSetRows(
  rows: SetRowInput[],
): { weight: number | null; reps: number | null }[] {
  return rows
    .map((r) => {
      const reps = r.reps.trim() === "" ? null : Number.parseInt(r.reps, 10);
      return {
        weight: parseDecimal(r.weight),
        reps: reps === null || Number.isNaN(reps) ? null : reps,
      };
    })
    .filter((s) => s.weight !== null || s.reps !== null);
}

/** Series guardadas → filas de texto para editar. */
export function setsToRows(sets: SavedSet[]): SetRowInput[] {
  return sets.map((s) => ({
    weight: s.weight !== null ? formatWeight(s.weight) : "",
    reps: s.reps !== null ? String(s.reps) : "",
  }));
}

/** Formatea un peso con coma decimal (es-AR), sin separador de miles. */
export function formatWeight(weight: number): string {
  return String(weight).replace(".", ",");
}

/** Resumen corto de series: "35kg × 12  ·  35kg × 10". */
export function summarizeSets(sets: SavedSet[]): string {
  return sets
    .map((s) => {
      const w = s.weight !== null ? `${formatWeight(s.weight)}kg` : "";
      const r = s.reps !== null ? `${s.reps}` : "";
      return [w, r].filter(Boolean).join(" × ");
    })
    .filter(Boolean)
    .join("  ·  ");
}

/**
 * Series de un entrenamiento, con la variante adelante y el detalle entre
 * paréntesis: "Barra · 35kg × 12 · 35kg × 10 (Agarre cerrado)".
 */
export function summarizeHistory(
  entry: Pick<HistoryEntry, "sets" | "note"> & { variant?: string | null },
): string {
  const sets = [entry.variant, summarizeSets(entry.sets)]
    .filter(Boolean)
    .join(" · ");
  const note = entry.note?.trim();
  if (!note) return sets;
  return sets ? `${sets} (${note})` : `(${note})`;
}

// ---------------------------------------------------------------------------
// Volumen, descanso y duración
// ---------------------------------------------------------------------------

/** Volumen de un ejercicio: suma de kg × reps de las series completas. */
export function setsVolume(
  sets: { weight: number | null; reps: number | null }[],
): number {
  return sets.reduce(
    (sum, s) =>
      s.weight !== null && s.reps !== null ? sum + s.weight * s.reps : sum,
    0,
  );
}

export type VolumeProgress = { before: number; after: number; percent: number };

/**
 * Progresión de volumen contra la última vez que hizo el ejercicio. Null si no
 * hay registro anterior con volumen o si no lo superó.
 */
export function volumeProgress(
  current: { weight: number | null; reps: number | null }[],
  previous: HistoryEntry | undefined,
): VolumeProgress | null {
  if (!previous) return null;
  const before = setsVolume(previous.sets);
  const after = setsVolume(current);
  if (before <= 0 || after <= before) return null;
  return {
    before,
    after,
    percent: Math.round(((after - before) / before) * 100),
  };
}

/** "1.200" (kg de volumen, sin decimales). */
export const formatVolume = (kg: number) =>
  Math.round(kg).toLocaleString("es-AR", { maximumFractionDigits: 0 });

/**
 * ¿Hay series sin terminar de cargar? Falta dato si alguna serie no tiene
 * repeticiones, o si algunas tienen kg y otras no. Si ninguna lleva kg se toma
 * como ejercicio con peso corporal (no se pide).
 */
export function hasIncompleteRows(rows: SetRowInput[]): boolean {
  const filled = (v: string) => v.trim() !== "";
  if (rows.some((r) => !filled(r.reps))) return true;
  const withWeight = rows.filter((r) => filled(r.weight)).length;
  return withWeight > 0 && withWeight < rows.length;
}

/** Duración "52:14" o "1:02:05". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Descanso legible: "45 s", "1:30 min". */
export function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")} min` : `${m} min`;
}

/** Descansos que el coach elige en el editor de rutinas (segundos). */
export const REST_OPTIONS = [
  30, 45, 60, 75, 90, 120, 150, 180, 240, 300,
] as const;

/** Fecha dd/mm/aaaa. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Fecha con día de la semana: "mar, 14/10/2026". */
export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Fecha corta dd/mm. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}
