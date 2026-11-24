import { describe, expect, it } from "vitest";

import {
  clearDraft,
  describeDraft,
  draftKey,
  DRAFT_TTL_MS,
  loadDraft,
  loadTimerStart,
  saveDraft,
  saveTimerStart,
  timerKey,
  type DraftStorage,
  type WorkoutDraft,
} from "./draft";

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const fail = () => {
  throw new Error("no storage");
};
const brokenStorage: DraftStorage = {
  getItem: fail,
  setItem: fail,
  removeItem: fail,
};

const data = {
  routineId: "r1",
  dayId: "d1",
  completed: ["e1", "e2"],
  rows: { e1: [{ weight: "40", reps: "10" }] },
  notes: { e1: "Lento" },
  variants: { e1: "Barra" },
};

describe("keys", () => {
  it("scopes drafts and timers by user and day", () => {
    expect(draftKey("u1", "d1")).toBe("brabus:workout-draft:u1:d1");
    expect(timerKey("u1", "d1")).toBe("brabus:workout-start:u1:d1");
  });
});

describe("saveDraft / loadDraft", () => {
  it("round-trips a draft", () => {
    const s = memoryStorage();
    saveDraft(s, "k", data);
    const draft = loadDraft(s, "k");
    expect(draft).toMatchObject({ v: 1, ...data });
    expect(typeof draft?.savedAt).toBe("string");
  });

  it("removes the draft when no exercise is completed", () => {
    const s = memoryStorage();
    saveDraft(s, "k", data);
    saveDraft(s, "k", { ...data, completed: [] });
    expect(s.data.has("k")).toBe(false);
  });

  it("expires drafts after 24 hours and deletes them", () => {
    const s = memoryStorage();
    saveDraft(s, "k", data);
    const savedAt = new Date(loadDraft(s, "k")!.savedAt).getTime();
    expect(
      loadDraft(s, "k", new Date(savedAt + DRAFT_TTL_MS - 1)),
    ).not.toBeNull();
    expect(loadDraft(s, "k", new Date(savedAt + DRAFT_TTL_MS))).toBeNull();
    expect(s.data.has("k")).toBe(false);
  });

  it("discards drafts from the future, broken JSON and other versions", () => {
    const s = memoryStorage();
    saveDraft(s, "k", data);
    const savedAt = new Date(loadDraft(s, "k")!.savedAt).getTime();
    expect(loadDraft(s, "k", new Date(savedAt - 1000))).toBeNull();

    s.setItem("bad", "{not json");
    expect(loadDraft(s, "bad")).toBeNull();
    expect(s.data.has("bad")).toBe(false);

    s.setItem(
      "v2",
      JSON.stringify({
        v: 2,
        savedAt: new Date().toISOString(),
        completed: ["e1"],
      }),
    );
    expect(loadDraft(s, "v2")).toBeNull();
  });

  it("never throws when storage is missing or failing", () => {
    expect(loadDraft(undefined, "k")).toBeNull();
    expect(loadDraft(brokenStorage, "k")).toBeNull();
    expect(() => saveDraft(brokenStorage, "k", data)).not.toThrow();
    expect(() => saveDraft(undefined, "k", data)).not.toThrow();
    expect(() => clearDraft(brokenStorage, "k")).not.toThrow();
    expect(() => clearDraft(undefined, "k")).not.toThrow();
  });

  it("clearDraft removes the key", () => {
    const s = memoryStorage();
    saveDraft(s, "k", data);
    clearDraft(s, "k");
    expect(s.data.size).toBe(0);
  });
});

describe("describeDraft", () => {
  it("describes when it was saved and how many exercises it has", () => {
    const draft: WorkoutDraft = {
      v: 1,
      savedAt: new Date(2026, 9, 19, 18, 40).toISOString(),
      ...data,
    };
    expect(describeDraft(draft)).toBe(
      "Del lun 19/10 a las 18:40 · 2 ejercicios guardados.",
    );
    expect(describeDraft({ ...draft, completed: ["e1"] })).toBe(
      "Del lun 19/10 a las 18:40 · 1 ejercicio guardado.",
    );
  });
});

describe("workout timer start", () => {
  it("saves and loads the start time within 24 hours", () => {
    const s = memoryStorage();
    saveTimerStart(s, "t", 1_000_000);
    expect(loadTimerStart(s, "t", 1_000_000 + 60_000)).toBe(1_000_000);
  });

  it("drops expired, future or invalid start times", () => {
    const s = memoryStorage();
    saveTimerStart(s, "t", 1_000_000);
    expect(loadTimerStart(s, "t", 1_000_000 + DRAFT_TTL_MS)).toBeNull();
    expect(s.data.has("t")).toBe(false);

    saveTimerStart(s, "t", 1_000_000);
    expect(loadTimerStart(s, "t", 999_999)).toBeNull();

    s.setItem("t", "garbage");
    expect(loadTimerStart(s, "t", 1_000_000)).toBeNull();
    expect(loadTimerStart(memoryStorage(), "missing")).toBeNull();
  });

  it("never throws without storage", () => {
    expect(loadTimerStart(undefined, "t")).toBeNull();
    expect(loadTimerStart(brokenStorage, "t")).toBeNull();
    expect(() => saveTimerStart(brokenStorage, "t", 1)).not.toThrow();
  });
});
