import { describe, expect, it } from "vitest";

import { visibleLogs, type StudentSession } from "./clients";
import { sessionDuration } from "./history";

describe("sessionDuration", () => {
  it("measures from 'Empezar' to the save", () => {
    expect(
      sessionDuration("2026-10-21T20:00:00.000Z", "2026-10-21T20:52:14.000Z"),
    ).toBe((52 * 60 + 14) * 1000);
  });

  it("is null without the timer (start = end) or without an end", () => {
    expect(sessionDuration("2026-10-21T20:00:00.000Z", "2026-10-21T20:00:00.500Z")).toBeNull();
    expect(sessionDuration("2026-10-21T20:00:00.000Z", null)).toBeNull();
  });
});

describe("visibleLogs", () => {
  it("keeps exercises with sets or a note", () => {
    const log = (over: Partial<StudentSession["exercise_logs"][number]>) => ({
      completed: true,
      note: null,
      variant: null,
      exercise: { name: "Press" },
      set_logs: [],
      ...over,
    });
    const session: StudentSession = {
      id: "s1",
      finished_at: null,
      started_at: "2026-10-21T20:00:00.000Z",
      day: null,
      routine: null,
      exercise_logs: [
        log({ set_logs: [{ set_number: 1, weight: 40, reps: 10 }] }),
        log({ note: "Me dolió el hombro" }),
        log({}),
      ],
    };
    expect(visibleLogs(session)).toHaveLength(2);
  });
});
