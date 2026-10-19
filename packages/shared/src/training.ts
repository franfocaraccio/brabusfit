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
};

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

export type HistoryEntry = { date: string; sets: SavedSet[]; note: string | null };

/** Un ejercicio del día con su historial (últimas sesiones finalizadas). */
export type TrainingExercise = {
  id: string;
  name: string;
  setsReps: string;
  history: HistoryEntry[];
};

/** Fila de serie tal como se edita en pantalla (texto). */
export type SetRowInput = { weight: string; reps: string };

/** Convierte filas de texto en series (descarta las vacías). */
export function parseSetRows(rows: SetRowInput[]): { weight: number | null; reps: number | null }[] {
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

/** Series de un entrenamiento + su detalle entre paréntesis: "35kg × 12 · 35kg × 10 (Hecho en Smith)". */
export function summarizeHistory(entry: Pick<HistoryEntry, "sets" | "note">): string {
  const sets = summarizeSets(entry.sets);
  const note = entry.note?.trim();
  if (!note) return sets;
  return sets ? `${sets} (${note})` : `(${note})`;
}

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
