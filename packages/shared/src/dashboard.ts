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
};

export type StudentDashboard = {
  /** 7 valores (lunes..domingo): ¿entrenó ese día de esta semana? */
  thisWeek: boolean[];
  /** Índice de hoy en `thisWeek` (0 = lunes). */
  todayIndex: number;
  daysThisWeek: number;
  /** Últimas 8 semanas, la última es la semana en curso. */
  weeks: WeekSummary[];
  /** Promedio de días por semana en las semanas completas del período. */
  average: number;
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

  const weeks: WeekSummary[] = [];
  for (let i = CONSISTENCY_WEEKS - 1; i >= 0; i--) {
    const start = weekAt(i);
    weeks.push({ start, days: countWeek(start) });
  }

  const thisWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(current);
    d.setDate(d.getDate() + i);
    return days.has(dayKey(d));
  });

  const complete = weeks.slice(0, -1);
  const average = complete.reduce((n, w) => n + w.days, 0) / complete.length;

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
