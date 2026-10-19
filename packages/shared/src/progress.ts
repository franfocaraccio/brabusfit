/**
 * Cálculos de "Progreso" (gráficos de evolución), compartidos entre web y
 * mobile. Todo es puro: recibe las sesiones ya cargadas y devuelve series.
 */

import { formatShortDate, formatWeight } from "./training";

export type ProgressSet = { weight: number | null; reps: number | null };
export type ProgressEntry = { name: string; sets: ProgressSet[] };
export type ProgressSession = { id: string; date: string; entries: ProgressEntry[] };

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

export type Period = "1m" | "3m" | "6m" | "all";
export const PERIODS: { value: Period; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "all", label: "Todo" },
];
export const DEFAULT_PERIOD: Period = "3m";

/** Fecha desde la que se muestran datos (null = todo). */
export function periodStart(period: Period, now: Date = new Date()): Date | null {
  if (period === "all") return null;
  const months = period === "1m" ? 1 : period === "3m" ? 3 : 6;
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

const inPeriod = (iso: string, since: Date | null) => !since || new Date(iso) >= since;

// ---------------------------------------------------------------------------
// Ejercicios (agrupados por nombre entre rutinas)
// ---------------------------------------------------------------------------

/** Clave de agrupación: "Jalón  al Pecho" y "jalon al pecho" son el mismo ejercicio. */
export function exerciseKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const hasData = (sets: ProgressSet[]) => sets.some((s) => s.weight !== null || s.reps !== null);

export type ExerciseOption = {
  key: string;
  /** Nombre como se escribió la última vez. */
  name: string;
  sessions: number;
  lastDate: string;
};

/** Ejercicios con datos, el entrenado más recientemente primero. */
export function listExercises(sessions: ProgressSession[]): ExerciseOption[] {
  const byKey = new Map<string, ExerciseOption>();
  for (const s of sessions) {
    const seen = new Set<string>();
    for (const e of s.entries) {
      if (!hasData(e.sets)) continue;
      const key = exerciseKey(e.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, { key, name: e.name.trim(), sessions: 1, lastDate: s.date });
      } else {
        prev.sessions += 1;
        if (s.date >= prev.lastDate) {
          prev.lastDate = s.date;
          prev.name = e.name.trim();
        }
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

/** Series de un ejercicio en una sesión (si aparece dos veces, se juntan). */
function setsFor(session: ProgressSession, key: string): ProgressSet[] {
  return session.entries
    .filter((e) => exerciseKey(e.name) === key)
    .flatMap((e) => e.sets)
    .filter((s) => s.weight !== null || s.reps !== null);
}

// ---------------------------------------------------------------------------
// Serie por sesión (peso máximo y volumen)
// ---------------------------------------------------------------------------

export type ExercisePoint = {
  date: string;
  /** Peso más alto de la sesión (null si el ejercicio no usa peso). */
  maxWeight: number | null;
  /** Reps hechas con ese peso máximo (la mejor serie con ese peso). */
  repsAtMax: number | null;
  /** Suma de peso × reps. */
  volume: number;
  /** Para ejercicios sin peso: mejor serie y total de reps. */
  maxReps: number | null;
  totalReps: number;
};

export function exerciseSeries(
  sessions: ProgressSession[],
  key: string,
  since: Date | null,
): ExercisePoint[] {
  return sessions
    .filter((s) => inPeriod(s.date, since))
    .map((s) => ({ date: s.date, sets: setsFor(s, key) }))
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, sets }) => {
      let maxWeight: number | null = null;
      let repsAtMax: number | null = null;
      let volume = 0;
      let maxReps: number | null = null;
      let totalReps = 0;
      for (const s of sets) {
        if (s.weight !== null) {
          if (maxWeight === null || s.weight > maxWeight) {
            maxWeight = s.weight;
            repsAtMax = s.reps;
          } else if (s.weight === maxWeight && (s.reps ?? 0) > (repsAtMax ?? 0)) {
            repsAtMax = s.reps;
          }
        }
        if (s.reps !== null) {
          totalReps += s.reps;
          if (maxReps === null || s.reps > maxReps) maxReps = s.reps;
          if (s.weight !== null) volume += s.weight * s.reps;
        }
      }
      return { date, maxWeight, repsAtMax, volume: round1(volume), maxReps, totalReps };
    });
}

/** ¿El ejercicio se hace con peso? (si no, se grafican repeticiones) */
export function isWeighted(points: ExercisePoint[]): boolean {
  return points.some((p) => p.maxWeight !== null);
}

// ---------------------------------------------------------------------------
// Récords personales (de todo el historial)
// ---------------------------------------------------------------------------

/** 1RM estimado con la fórmula de Epley (peso × (1 + reps / 30)). */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return round1(weight * (1 + reps / 30));
}

export type PersonalRecords = {
  bestWeight: { weight: number; reps: number | null; date: string } | null;
  bestSet: { weight: number; reps: number; volume: number; date: string } | null;
  best1RM: { value: number; weight: number; reps: number; date: string } | null;
  /** Ejercicios sin peso. */
  bestReps: { reps: number; date: string } | null;
};

export function personalRecords(sessions: ProgressSession[], key: string): PersonalRecords {
  const r: PersonalRecords = { bestWeight: null, bestSet: null, best1RM: null, bestReps: null };
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const session of ordered) {
    for (const s of setsFor(session, key)) {
      const date = session.date;
      if (s.weight !== null) {
        if (
          !r.bestWeight ||
          s.weight > r.bestWeight.weight ||
          (s.weight === r.bestWeight.weight && (s.reps ?? 0) > (r.bestWeight.reps ?? 0))
        ) {
          r.bestWeight = { weight: s.weight, reps: s.reps, date };
        }
      }
      if (s.weight !== null && s.reps !== null && s.reps > 0) {
        const volume = round1(s.weight * s.reps);
        if (!r.bestSet || volume > r.bestSet.volume) {
          r.bestSet = { weight: s.weight, reps: s.reps, volume, date };
        }
        const value = estimate1RM(s.weight, s.reps);
        if (!r.best1RM || value > r.best1RM.value) {
          r.best1RM = { value, weight: s.weight, reps: s.reps, date };
        }
      }
      if (s.reps !== null && (!r.bestReps || s.reps > r.bestReps.reps)) {
        r.bestReps = { reps: s.reps, date };
      }
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// Frecuencia semanal (todas las sesiones)
// ---------------------------------------------------------------------------

export type WeekBucket = { weekStart: string; count: number };

/** Lunes 00:00 (hora local) de la semana de `d`. */
function weekStartOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - day);
  return x;
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Sesiones por semana, incluyendo semanas sin entrenar (máximo 52 semanas). */
export function weeklyFrequency(
  sessions: ProgressSession[],
  since: Date | null,
  now: Date = new Date(),
): WeekBucket[] {
  const dates = sessions.map((s) => new Date(s.date)).filter((d) => !since || d >= since);
  if (dates.length === 0) return [];
  const first = since ?? new Date(Math.min(...dates.map((d) => d.getTime())));
  const end = weekStartOf(now);
  let start = weekStartOf(first);
  const maxStart = new Date(end);
  maxStart.setDate(maxStart.getDate() - 7 * 51);
  if (start < maxStart) start = maxStart;

  const counts = new Map<string, number>();
  for (const d of dates) {
    const k = isoDay(weekStartOf(d));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: WeekBucket[] = [];
  for (const w = new Date(start); w <= end; w.setDate(w.getDate() + 7)) {
    const k = isoDay(w);
    out.push({ weekStart: k, count: counts.get(k) ?? 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Textos de los gráficos (iguales en web y mobile)
// ---------------------------------------------------------------------------

export type ChartData = { label: string; value: number; detail: string };
export type ChartSpec = { title: string; subtitle: string; points: ChartData[] };

const kg = (n: number) => `${formatWeight(n)} kg`;

/** Gráfico principal (peso máximo) y de volumen para un ejercicio. */
export function exerciseCharts(points: ExercisePoint[]): { main: ChartSpec; volume: ChartSpec } {
  if (isWeighted(points)) {
    const weighted = points.filter((p) => p.maxWeight !== null);
    return {
      main: {
        title: "Peso máximo",
        subtitle: "El peso más alto de cada entrenamiento",
        points: weighted.map((p) => ({
          label: formatShortDate(p.date),
          value: p.maxWeight!,
          detail: `${formatShortDate(p.date)} · ${kg(p.maxWeight!)}${p.repsAtMax !== null ? ` × ${p.repsAtMax}` : ""}`,
        })),
      },
      volume: {
        title: "Volumen",
        subtitle: "Peso × repeticiones de todas las series",
        points: points.map((p) => ({
          label: formatShortDate(p.date),
          value: p.volume,
          detail: `${formatShortDate(p.date)} · ${kg(p.volume)}`,
        })),
      },
    };
  }
  return {
    main: {
      title: "Repeticiones máximas",
      subtitle: "La mejor serie de cada entrenamiento",
      points: points.map((p) => ({
        label: formatShortDate(p.date),
        value: p.maxReps ?? 0,
        detail: `${formatShortDate(p.date)} · ${p.maxReps ?? 0} reps`,
      })),
    },
    volume: {
      title: "Repeticiones totales",
      subtitle: "Suma de reps de todas las series",
      points: points.map((p) => ({
        label: formatShortDate(p.date),
        value: p.totalReps,
        detail: `${formatShortDate(p.date)} · ${p.totalReps} reps`,
      })),
    },
  };
}

/** Gráfico de sesiones por semana. */
export function frequencyChart(buckets: WeekBucket[]): ChartSpec {
  return {
    title: "Frecuencia semanal",
    subtitle: "Entrenamientos por semana (todas las rutinas)",
    points: buckets.map((b) => {
      const label = formatShortDate(`${b.weekStart}T12:00:00`);
      return {
        label,
        value: b.count,
        detail: `Semana del ${label} · ${b.count} ${b.count === 1 ? "entrenamiento" : "entrenamientos"}`,
      };
    }),
  };
}

export type RecordCard = { label: string; value: string; detail: string };

/** Tarjetas de récords personales. */
export function recordCards(r: PersonalRecords): RecordCard[] {
  const cards: RecordCard[] = [];
  if (r.bestWeight) {
    cards.push({
      label: "Mejor peso",
      value: kg(r.bestWeight.weight),
      detail: `${r.bestWeight.reps !== null ? `× ${r.bestWeight.reps} · ` : ""}${formatShortDate(r.bestWeight.date)}`,
    });
  }
  if (r.bestSet) {
    cards.push({
      label: "Mejor serie",
      value: `${kg(r.bestSet.weight)} × ${r.bestSet.reps}`,
      detail: `${kg(r.bestSet.volume)} · ${formatShortDate(r.bestSet.date)}`,
    });
  }
  if (r.best1RM) {
    cards.push({
      label: "1RM estimado",
      value: kg(r.best1RM.value),
      detail: `con ${kg(r.best1RM.weight)} × ${r.best1RM.reps}`,
    });
  }
  if (cards.length === 0 && r.bestReps) {
    cards.push({
      label: "Más repeticiones",
      value: `${r.bestReps.reps} reps`,
      detail: formatShortDate(r.bestReps.date),
    });
  }
  return cards;
}

/** Todo lo que muestra la pantalla de Progreso para un ejercicio y período. */
export function buildProgress(
  sessions: ProgressSession[],
  key: string | null,
  period: Period,
  now: Date = new Date(),
) {
  const exercises = listExercises(sessions);
  const selected = exercises.find((e) => e.key === key) ?? exercises[0] ?? null;
  const since = periodStart(period, now);
  const points = selected ? exerciseSeries(sessions, selected.key, since) : [];
  return {
    exercises,
    selected,
    records: selected ? recordCards(personalRecords(sessions, selected.key)) : [],
    charts: exerciseCharts(points),
    frequency: frequencyChart(weeklyFrequency(sessions, since, now)),
  };
}

// ---------------------------------------------------------------------------
// Escalas para dibujar (las usan los gráficos SVG de web y mobile)
// ---------------------------------------------------------------------------

/** Eje Y "lindo": mínimo, máximo y marcas redondas. */
export function niceScale(
  minValue: number,
  maxValue: number,
  tickCount = 4,
  { zeroBased = false }: { zeroBased?: boolean } = {},
): { min: number; max: number; ticks: number[] } {
  let lo = zeroBased ? 0 : minValue;
  let hi = maxValue;
  if (hi === lo) {
    hi = hi === 0 ? 1 : hi * 1.1;
    lo = zeroBased ? 0 : lo * 0.9;
  }
  const rawStep = (hi - lo) / tickCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? 10 * mag;
  const min = zeroBased ? 0 : Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(round1(v));
  return { min, max, ticks };
}

/** Número corto para ejes: 1250 → "1,3k", 62.5 → "62,5". */
export function formatAxis(n: number): string {
  if (Math.abs(n) >= 10000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `${String(round1(n / 1000)).replace(".", ",")}k`;
  return String(round1(n)).replace(".", ",");
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
