import { describe, expect, it } from "vitest";

import {
  buildProgress,
  estimate1RM,
  exerciseCharts,
  exerciseKey,
  exerciseSeries,
  formatAxis,
  frequencyChart,
  isWeighted,
  listExercises,
  niceScale,
  periodStart,
  personalRecords,
  recordCards,
  weeklyFrequency,
  type ProgressSession,
} from "./progress";
import { formatShortDate } from "./training";

// Sesiones a las 12:00 locales para que el día no dependa de la zona horaria.
const at = (day: string) => new Date(`${day}T12:00:00`).toISOString();

const sessions: ProgressSession[] = [
  {
    id: "s1",
    date: at("2026-09-01"),
    entries: [
      {
        catalogId: "bench",
        name: "Press banca",
        sets: [
          { weight: 60, reps: 10 },
          { weight: 60, reps: 8 },
        ],
      },
      { catalogId: "pullup", name: "Dominadas", sets: [{ weight: null, reps: 8 }] },
    ],
  },
  {
    id: "s2",
    date: at("2026-09-08"),
    entries: [
      {
        catalogId: "bench",
        name: "Press banca (barra)",
        sets: [
          { weight: 65, reps: 6 },
          { weight: 65, reps: 8 },
          { weight: 50, reps: 12 },
        ],
      },
      { catalogId: "pullup", name: "Dominadas", sets: [{ weight: null, reps: 10 }] },
    ],
  },
  {
    id: "s3",
    date: at("2026-09-09"),
    entries: [
      // Sin datos: no cuenta como sesión del ejercicio.
      { catalogId: "row", name: "Remo", sets: [{ weight: null, reps: null }] },
      // Sin catálogo: agrupa por nombre normalizado.
      { name: "Jalón  al Pecho", sets: [{ weight: 40, reps: 10 }] },
    ],
  },
];

describe("exerciseKey", () => {
  it("ignores accents, case and repeated spaces", () => {
    expect(exerciseKey("  Jalón  al Pecho ")).toBe("jalon al pecho");
    expect(exerciseKey("JALON AL PECHO")).toBe("jalon al pecho");
  });
});

describe("periodStart", () => {
  const now = new Date(2026, 9, 15);
  it("subtracts whole months", () => {
    expect(periodStart("1m", now)).toEqual(new Date(2026, 8, 15));
    expect(periodStart("3m", now)).toEqual(new Date(2026, 6, 15));
    expect(periodStart("6m", now)).toEqual(new Date(2026, 3, 15));
    expect(periodStart("all", now)).toBeNull();
  });
});

describe("listExercises", () => {
  it("groups by catalog id (or normalized name), most recent first", () => {
    const list = listExercises(sessions);
    expect(list.map((e) => [e.key, e.sessions])).toEqual([
      ["jalon al pecho", 1],
      ["bench", 2],
      ["pullup", 2],
    ]);
    // El nombre es el de la última vez que se hizo.
    expect(list.find((e) => e.key === "bench")?.name).toBe(
      "Press banca (barra)",
    );
  });
});

describe("exerciseSeries", () => {
  it("computes max weight, reps at max and volume per session", () => {
    expect(exerciseSeries(sessions, "bench", null)).toEqual([
      {
        date: at("2026-09-01"),
        maxWeight: 60,
        repsAtMax: 10,
        volume: 1080,
        maxReps: 10,
        totalReps: 18,
      },
      {
        date: at("2026-09-08"),
        maxWeight: 65,
        repsAtMax: 8,
        volume: 1510,
        maxReps: 12,
        totalReps: 26,
      },
    ]);
  });

  it("filters by period start", () => {
    const since = new Date(2026, 8, 5);
    expect(exerciseSeries(sessions, "bench", since).map((p) => p.maxWeight)).toEqual([65]);
  });

  it("tracks reps for bodyweight exercises", () => {
    const points = exerciseSeries(sessions, "pullup", null);
    expect(isWeighted(points)).toBe(false);
    expect(points.map((p) => p.maxReps)).toEqual([8, 10]);
  });
});

describe("personalRecords / estimate1RM", () => {
  it("uses the Epley formula and keeps 1 rep as is", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 10)).toBe(133.3);
  });

  it("finds best weight, best set and best estimated 1RM", () => {
    const r = personalRecords(sessions, "bench");
    expect(r.bestWeight).toEqual({ weight: 65, reps: 8, date: at("2026-09-08") });
    expect(r.bestSet).toEqual({
      weight: 60,
      reps: 10,
      volume: 600,
      date: at("2026-09-01"),
    });
    expect(r.best1RM).toEqual({
      value: 82.3,
      weight: 65,
      reps: 8,
      date: at("2026-09-08"),
    });
  });

  it("builds record cards, with reps only for bodyweight exercises", () => {
    expect(recordCards(personalRecords(sessions, "bench")).map((c) => c.label)).toEqual([
      "Mejor peso",
      "Mejor serie",
      "1RM estimado",
    ]);
    expect(recordCards(personalRecords(sessions, "pullup"))).toEqual([
      {
        label: "Más repeticiones",
        value: "10 reps",
        detail: formatShortDate(at("2026-09-08")),
      },
    ]);
  });
});

describe("weeklyFrequency", () => {
  it("counts sessions per week starting on Monday, including empty weeks", () => {
    const now = new Date(2026, 8, 20); // domingo 20/09
    expect(weeklyFrequency(sessions, null, now)).toEqual([
      { weekStart: "2026-08-31", count: 1 },
      { weekStart: "2026-09-07", count: 2 },
      { weekStart: "2026-09-14", count: 0 },
    ]);
  });

  it("returns nothing without sessions in the period", () => {
    expect(weeklyFrequency(sessions, new Date(2026, 9, 1), new Date(2026, 9, 2))).toEqual(
      [],
    );
  });

  it("caps the range at 52 weeks", () => {
    const old: ProgressSession[] = [{ id: "x", date: at("2020-01-01"), entries: [] }];
    expect(weeklyFrequency(old, null, new Date(2026, 8, 20))).toHaveLength(52);
  });
});

describe("chart texts", () => {
  it("charts weight and volume for weighted exercises", () => {
    const { main, volume } = exerciseCharts(exerciseSeries(sessions, "bench", null));
    expect(main.title).toBe("Peso máximo");
    const label = formatShortDate(at("2026-09-08"));
    expect(main.points[1]).toEqual({
      label,
      value: 65,
      detail: `${label} · 65 kg × 8`,
    });
    expect(volume.points.map((p) => p.value)).toEqual([1080, 1510]);
  });

  it("charts reps for bodyweight exercises", () => {
    const { main, volume } = exerciseCharts(exerciseSeries(sessions, "pullup", null));
    expect(main.title).toBe("Repeticiones máximas");
    expect(volume.title).toBe("Repeticiones totales");
  });

  it("describes weekly frequency in singular or plural", () => {
    const chart = frequencyChart([
      { weekStart: "2026-09-07", count: 1 },
      { weekStart: "2026-09-14", count: 2 },
    ]);
    const week = (d: string) => formatShortDate(`${d}T12:00:00`);
    expect(chart.points.map((p) => p.detail)).toEqual([
      `Semana del ${week("2026-09-07")} · 1 entrenamiento`,
      `Semana del ${week("2026-09-14")} · 2 entrenamientos`,
    ]);
  });
});

describe("buildProgress", () => {
  it("falls back to the most recent exercise when the key is unknown", () => {
    const p = buildProgress(sessions, "nope", "all", new Date(2026, 8, 20));
    expect(p.selected?.key).toBe("jalon al pecho");
    expect(p.records[0].label).toBe("Mejor peso");
  });

  it("handles a student without sessions", () => {
    const p = buildProgress([], null, "3m");
    expect(p.selected).toBeNull();
    expect(p.records).toEqual([]);
    expect(p.charts.main.points).toEqual([]);
    expect(p.frequency.points).toEqual([]);
  });
});

describe("niceScale / formatAxis", () => {
  it("rounds the axis to nice steps", () => {
    expect(niceScale(62, 81)).toEqual({ min: 60, max: 85, ticks: [60, 65, 70, 75, 80, 85] });
    expect(niceScale(0, 1250, 4, { zeroBased: true })).toEqual({
      min: 0,
      max: 1500,
      ticks: [0, 500, 1000, 1500],
    });
  });

  it("widens a flat range so the chart is not empty", () => {
    const s = niceScale(60, 60);
    expect(s.min).toBeLessThan(60);
    expect(s.max).toBeGreaterThan(60);
    expect(niceScale(0, 0, 4, { zeroBased: true }).max).toBeGreaterThan(0);
  });

  it("shortens large numbers with k and decimal comma", () => {
    expect(formatAxis(62.5)).toBe("62,5");
    expect(formatAxis(1250)).toBe("1,3k");
    expect(formatAxis(12500)).toBe("13k");
  });
});
