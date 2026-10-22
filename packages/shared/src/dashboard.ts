/**
 * Métricas del inicio del alumno. Se calculan con la hora local del
 * dispositivo (las semanas van de lunes a domingo) y cuentan DÍAS entrenados:
 * dos sesiones el mismo día valen una.
 */

export const CONSISTENCY_WEEKS = 8;

/** Lunes 00:00 (hora local) de la semana de `d`. */
export function weekStart(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export type WeekSummary = {
  /** Lunes de la semana. */
  start: Date;
  /** Días con al menos un entrenamiento. */
  days: number;
  /** Lunes..domingo: entrenó, no entrenó, o todavía no llegó (semana en curso). */
  daily: DayState[];
};

export type DayState = "done" | "rest" | "future";

export type StudentDashboard = {
  /** 7 valores (lunes..domingo): ¿entrenó ese día de esta semana? */
  thisWeek: boolean[];
  /** Índice de hoy en `thisWeek` (0 = lunes). */
  todayIndex: number;
  daysThisWeek: number;
  /** Últimas 8 semanas, la última es la semana en curso. */
  weeks: WeekSummary[];
  /**
   * Promedio de días por semana en las semanas completas del período, desde la
   * primera que entrenó. Null si todavía no tiene ninguna semana completa.
   */
  average: number | null;
  /** Semanas seguidas cumpliendo el objetivo (incluye la actual si ya lo cumplió). */
  streak: number;
};

/**
 * @param finishedAt fechas ISO de las sesiones terminadas.
 * @param goal objetivo de días por semana (null = sin objetivo, sin racha).
 */
export function studentDashboard(
  finishedAt: string[],
  goal: number | null,
  now = new Date(),
): StudentDashboard {
  const days = new Set(finishedAt.map((iso) => dayKey(new Date(iso))));
  const current = weekStart(now);

  const countWeek = (start: Date) => {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      if (days.has(dayKey(d))) n++;
    }
    return n;
  };
  // Semanas por fecha calendario (evita corrimientos por cambio de horario).
  const weekAt = (offset: number) => {
    const s = new Date(current);
    s.setDate(s.getDate() - offset * 7);
    return s;
  };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daily = (start: Date): DayState[] =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d > today ? "future" : days.has(dayKey(d)) ? "done" : "rest";
    });

  const weeks: WeekSummary[] = [];
  for (let i = CONSISTENCY_WEEKS - 1; i >= 0; i--) {
    const start = weekAt(i);
    weeks.push({ start, days: countWeek(start), daily: daily(start) });
  }

  const thisWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(current);
    d.setDate(d.getDate() + i);
    return days.has(dayKey(d));
  });

  // Semanas completas desde la primera con entrenamientos (antes no usaba la app).
  const first = finishedAt.reduce<Date | null>((min, iso) => {
    const d = new Date(iso);
    return min === null || d < min ? d : min;
  }, null);
  const complete = weeks
    .slice(0, -1)
    .filter((w) => first !== null && w.start >= weekStart(first));
  const average =
    complete.length > 0 ? complete.reduce((n, w) => n + w.days, 0) / complete.length : null;

  let streak = 0;
  if (goal) {
    const thisWeekDone = weeks[weeks.length - 1].days >= goal;
    // La semana en curso no corta la racha si todavía no llegó al objetivo.
    for (let i = 1; ; i++) {
      if (countWeek(weekAt(i)) >= goal) streak++;
      else break;
      if (i > 520) break;
    }
    if (thisWeekDone) streak++;
  }

  return {
    thisWeek,
    todayIndex: (now.getDay() + 6) % 7,
    daysThisWeek: thisWeek.filter(Boolean).length,
    weeks,
    average,
    streak,
  };
}

// ---------------------------------------------------------------------------
// Inicio del coach
// ---------------------------------------------------------------------------

/** Días entrenados esta semana (hora local) por usuario. */
export function trainedThisWeek(
  sessions: { userId: string; finishedAt: string }[],
  now = new Date(),
): Map<string, number> {
  const start = weekStart(now);
  const days = new Map<string, Set<string>>();
  for (const s of sessions) {
    const d = new Date(s.finishedAt);
    if (d < start) continue;
    let set = days.get(s.userId);
    if (!set) days.set(s.userId, (set = new Set()));
    set.add(dayKey(d));
  }
  return new Map([...days].map(([id, set]) => [id, set.size]));
}

export const GROWTH_MONTHS = 6;

export type MonthCount = {
  /** Primer día del mes. */
  start: Date;
  /** Clientes activos (no archivados) al cierre del mes, o hoy si es el actual. */
  count: number;
  /** Fichas creadas en el mes. */
  added: number;
  /** Fichas archivadas en el mes. */
  removed: number;
};

/** Clientes activos mes a mes (los últimos 6 meses, el último es el actual). */
export function clientGrowth(
  clients: { createdAt: string; archivedAt: string | null }[],
  now = new Date(),
): MonthCount[] {
  const out: MonthCount[] = [];
  for (let i = GROWTH_MONTHS - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const end = i === 0 ? now : next;
    let count = 0;
    let added = 0;
    let removed = 0;
    for (const c of clients) {
      const created = new Date(c.createdAt);
      const archived = c.archivedAt ? new Date(c.archivedAt) : null;
      if (created < end && (archived === null || archived >= end)) count++;
      if (created >= start && created < next) added++;
      if (archived && archived >= start && archived < next) removed++;
    }
    out.push({ start, count, added, removed });
  }
  return out;
}

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "oct" (para el eje del gráfico). */
export const shortMonth = (d: Date) => MONTH_SHORT[d.getMonth()];

/**
 * Etiquetas de mes para la grilla de consistencia: el mes donde empieza cada
 * semana, solo cuando cambia. Si dos quedan pegadas se omite la primera (como GitHub).
 */
export function monthLabels(weeks: { start: Date }[]): string[] {
  const labels = weeks.map((w, i) =>
    i === 0 || w.start.getMonth() !== weeks[i - 1].start.getMonth() ? shortMonth(w.start) : "",
  );
  return labels.map((l, i) => (l && labels[i + 1] ? "" : l));
}

export const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "Miércoles, 21 de octubre". */
export function longDate(d = new Date()): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** "31/8" (para el eje del gráfico). */
export const shortDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
