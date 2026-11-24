import { describe, expect, it } from "vitest";

import {
  clientGrowth,
  fitConsistencyGrid,
  longDate,
  monthLabels,
  shortDate,
  studentDashboard,
  trainedThisWeek,
  weekStart,
} from "./dashboard";

// Hora local (TZ fijada en vitest.config.mts).
const local = (y: number, m: number, d: number, h = 18) =>
  new Date(y, m - 1, d, h).toISOString();

// Miércoles 21/10/2026 a la tarde.
const NOW = new Date(2026, 9, 21, 20);

describe("weekStart", () => {
  it("returns Monday 00:00 of the week", () => {
    expect(weekStart(NOW)).toEqual(new Date(2026, 9, 19));
    expect(weekStart(new Date(2026, 9, 25, 23))).toEqual(new Date(2026, 9, 19));
    expect(weekStart(new Date(2026, 9, 19, 0))).toEqual(new Date(2026, 9, 19));
  });
});

describe("fitConsistencyGrid", () => {
  it("fits as many weeks as possible between 4 and 52", () => {
    expect(fitConsistencyGrid(300, { cell: 12, gap: 3, label: 20 })).toEqual({
      weeks: 18,
      cell: 280 / 18 - 3,
    });
    expect(fitConsistencyGrid(10, { cell: 12, gap: 3, label: 20 }).weeks).toBe(4);
    expect(fitConsistencyGrid(5000, { cell: 12, gap: 3, label: 20 }).weeks).toBe(52);
  });
});

describe("studentDashboard", () => {
  it("counts training days (not sessions) for this week", () => {
    const d = studentDashboard(
      [local(2026, 10, 19, 9), local(2026, 10, 19, 19), local(2026, 10, 21)],
      3,
      NOW,
      4,
    );
    expect(d.thisWeek).toEqual([true, false, true, false, false, false, false]);
    expect(d.todayIndex).toBe(2);
    expect(d.daysThisWeek).toBe(2);
    expect(d.weeks).toHaveLength(4);
    expect(d.weeks[3].daily).toEqual([
      "done",
      "rest",
      "done",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("averages complete weeks since the first training", () => {
    const d = studentDashboard(
      [
        // Semana del 05/10: 2 días. Semana del 12/10: 3 días.
        local(2026, 10, 6),
        local(2026, 10, 8),
        local(2026, 10, 12),
        local(2026, 10, 14),
        local(2026, 10, 16),
      ],
      null,
      NOW,
      4,
    );
    // Antes del 05/10 no usaba la app: esas semanas no cuentan.
    expect(d.average).toBe(2.5);
    expect(d.streak).toBe(0);
  });

  it("has no average without a complete week", () => {
    expect(studentDashboard([local(2026, 10, 20)], 3, NOW).average).toBeNull();
    expect(studentDashboard([], 3, NOW).average).toBeNull();
  });

  it("counts the streak of weeks that met the goal", () => {
    const sessions = [
      local(2026, 10, 6),
      local(2026, 10, 8),
      local(2026, 10, 13),
      local(2026, 10, 15),
    ];
    // La semana en curso todavía no llegó al objetivo: no corta la racha.
    expect(studentDashboard(sessions, 2, NOW).streak).toBe(2);
    // Si ya lo cumplió, suma.
    expect(
      studentDashboard([...sessions, local(2026, 10, 19), local(2026, 10, 20)], 2, NOW)
        .streak,
    ).toBe(3);
    // Una semana sin cumplir corta la racha.
    expect(studentDashboard([local(2026, 10, 6), local(2026, 10, 8)], 2, NOW).streak).toBe(0);
  });
});

describe("trainedThisWeek", () => {
  it("counts distinct days per user since Monday", () => {
    const map = trainedThisWeek(
      [
        { userId: "a", finishedAt: local(2026, 10, 19, 9) },
        { userId: "a", finishedAt: local(2026, 10, 19, 19) },
        { userId: "a", finishedAt: local(2026, 10, 20) },
        { userId: "b", finishedAt: local(2026, 10, 18) },
      ],
      NOW,
    );
    expect(Object.fromEntries(map)).toEqual({ a: 2 });
  });
});

describe("clientGrowth", () => {
  it("counts active clients at the end of each of the last 6 months", () => {
    const months = clientGrowth(
      [
        { createdAt: local(2026, 3, 10), archivedAt: null },
        { createdAt: local(2026, 6, 2), archivedAt: local(2026, 8, 20) },
        { createdAt: local(2026, 10, 5), archivedAt: null },
      ],
      NOW,
    );
    expect(months.map((m) => [m.start.getMonth() + 1, m.count, m.added, m.removed])).toEqual([
      [5, 1, 0, 0],
      [6, 2, 1, 0],
      [7, 2, 0, 0],
      [8, 1, 0, 1],
      [9, 1, 0, 0],
      [10, 2, 1, 0],
    ]);
  });
});

describe("labels", () => {
  it("labels months only when they change and skips crowded ones", () => {
    const weeks = [
      new Date(2026, 8, 21),
      new Date(2026, 8, 28),
      new Date(2026, 9, 5),
      new Date(2026, 9, 12),
    ].map((start) => ({ start }));
    expect(monthLabels(weeks)).toEqual(["sep", "", "oct", ""]);
    // "sep" queda pegado a "oct" y se omite (como GitHub).
    expect(monthLabels(weeks.slice(1))).toEqual(["", "oct", ""]);
    expect(monthLabels(weeks.slice(2))).toEqual(["oct", ""]);
  });

  it("formats dates in Spanish", () => {
    expect(longDate(NOW)).toBe("Miércoles, 21 de octubre");
    expect(shortDate(new Date(2026, 7, 31))).toBe("31/8");
  });
});
