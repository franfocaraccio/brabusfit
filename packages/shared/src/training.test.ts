import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatRest,
  formatVolume,
  formatWeight,
  hasIncompleteRows,
  historyLabel,
  parseSetRows,
  setsToRows,
  setsVolume,
  summarizeHistory,
  summarizeSets,
  volumeProgress,
  type HistoryEntry,
} from "./training";

const entry = (sets: HistoryEntry["sets"]): HistoryEntry => ({
  date: "2026-10-01T18:00:00Z",
  sets,
  note: null,
  variant: null,
});

describe("parseSetRows", () => {
  it("parses decimal weights with comma and integer reps", () => {
    expect(
      parseSetRows([
        { weight: "62,5", reps: "10" },
        { weight: "60", reps: " 8 " },
      ]),
    ).toEqual([
      { weight: 62.5, reps: 10 },
      { weight: 60, reps: 8 },
    ]);
  });

  it("keeps rows with only weight or only reps and drops empty ones", () => {
    expect(
      parseSetRows([
        { weight: "", reps: "12" },
        { weight: "", reps: "" },
        { weight: "40", reps: "" },
      ]),
    ).toEqual([
      { weight: null, reps: 12 },
      { weight: 40, reps: null },
    ]);
  });

  it("truncates decimal reps and ignores invalid text", () => {
    expect(parseSetRows([{ weight: "abc", reps: "8.7" }])).toEqual([
      { weight: null, reps: 8 },
    ]);
    expect(parseSetRows([{ weight: "x", reps: "y" }])).toEqual([]);
  });
});

describe("setsToRows / formatWeight", () => {
  it("formats saved sets as editable text with decimal comma", () => {
    expect(
      setsToRows([
        { set_number: 1, weight: 22.5, reps: 12 },
        { set_number: 2, weight: null, reps: 15 },
        { set_number: 3, weight: 30, reps: null },
      ]),
    ).toEqual([
      { weight: "22,5", reps: "12" },
      { weight: "", reps: "15" },
      { weight: "30", reps: "" },
    ]);
    expect(formatWeight(1000.5)).toBe("1000,5");
  });
});

describe("summarizeSets / summarizeHistory", () => {
  it("summarizes sets with weight and reps", () => {
    expect(
      summarizeSets([
        { set_number: 1, weight: 35, reps: 12 },
        { set_number: 2, weight: 37.5, reps: 10 },
        { set_number: 3, weight: null, reps: 8 },
        { set_number: 4, weight: null, reps: null },
      ]),
    ).toBe("35kg × 12  ·  37,5kg × 10  ·  8");
  });

  it("puts the variant first and the note in parentheses", () => {
    const sets = [{ set_number: 1, weight: 35, reps: 12 }];
    expect(summarizeHistory({ sets, note: null })).toBe("35kg × 12");
    expect(
      summarizeHistory({ sets, note: " Agarre cerrado ", variant: "Barra" }),
    ).toBe("Barra · 35kg × 12 (Agarre cerrado)");
    expect(summarizeHistory({ sets: [], note: "Solo nota" })).toBe(
      "(Solo nota)",
    );
    expect(summarizeHistory({ sets: [], note: "  " })).toBe("");
  });

  it("labels the history in singular or plural", () => {
    expect(historyLabel(1)).toBe("Último entrenamiento");
    expect(historyLabel(3)).toBe("Últimos entrenamientos");
  });
});

describe("setsVolume / volumeProgress", () => {
  it("adds weight × reps of complete sets only", () => {
    expect(
      setsVolume([
        { weight: 50, reps: 10 },
        { weight: 52.5, reps: 8 },
        { weight: null, reps: 12 },
        { weight: 60, reps: null },
      ]),
    ).toBe(920);
  });

  it("reports progress only when the volume went up", () => {
    const previous = entry([{ set_number: 1, weight: 50, reps: 10 }]);
    expect(volumeProgress([{ weight: 50, reps: 12 }], previous)).toEqual({
      before: 500,
      after: 600,
      percent: 20,
    });
    expect(volumeProgress([{ weight: 50, reps: 10 }], previous)).toBeNull();
    expect(volumeProgress([{ weight: 40, reps: 10 }], previous)).toBeNull();
  });

  it("returns null without a previous entry with volume", () => {
    expect(volumeProgress([{ weight: 50, reps: 10 }], undefined)).toBeNull();
    const bodyweight = entry([{ set_number: 1, weight: null, reps: 15 }]);
    expect(volumeProgress([{ weight: 10, reps: 15 }], bodyweight)).toBeNull();
  });

  it("rounds the percentage", () => {
    const previous = entry([{ set_number: 1, weight: 30, reps: 10 }]);
    expect(volumeProgress([{ weight: 31, reps: 10 }], previous)?.percent).toBe(
      3,
    );
  });
});

describe("hasIncompleteRows", () => {
  it("flags sets without reps", () => {
    expect(hasIncompleteRows([{ weight: "40", reps: "" }])).toBe(true);
    expect(hasIncompleteRows([{ weight: "", reps: " " }])).toBe(true);
  });

  it("flags a mix of sets with and without weight", () => {
    expect(
      hasIncompleteRows([
        { weight: "40", reps: "10" },
        { weight: "", reps: "10" },
      ]),
    ).toBe(true);
  });

  it("accepts all-weighted or all-bodyweight sets", () => {
    expect(
      hasIncompleteRows([
        { weight: "40", reps: "10" },
        { weight: "42,5", reps: "8" },
      ]),
    ).toBe(false);
    expect(
      hasIncompleteRows([
        { weight: "", reps: "12" },
        { weight: "", reps: "10" },
      ]),
    ).toBe(false);
  });
});

describe("formatDuration / formatRest / formatVolume", () => {
  it("formats durations as m:ss or h:mm:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-5000)).toBe("0:00");
    expect(formatDuration(59_999)).toBe("0:59");
    expect(formatDuration((52 * 60 + 14) * 1000)).toBe("52:14");
    expect(formatDuration((3600 + 2 * 60 + 5) * 1000)).toBe("1:02:05");
  });

  it("formats rest times in seconds or minutes", () => {
    expect(formatRest(45)).toBe("45 s");
    expect(formatRest(60)).toBe("1 min");
    expect(formatRest(90)).toBe("1:30 min");
    expect(formatRest(125)).toBe("2:05 min");
  });

  it("formats volume with thousands separator and no decimals", () => {
    expect(formatVolume(1200)).toBe("1.200");
    expect(formatVolume(999.6)).toBe("1.000");
  });
});
