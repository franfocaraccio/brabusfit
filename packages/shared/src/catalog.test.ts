import { describe, expect, it } from "vitest";

import {
  findCatalogByName,
  muscleGroupLabel,
  searchCatalog,
  type CatalogEntry,
} from "./catalog";

const entries: CatalogEntry[] = [
  { id: "1", name: "Press banca", muscle_group: "pecho", owner_id: null },
  { id: "2", name: "Press inclinado", muscle_group: "pecho", owner_id: null },
  { id: "3", name: "Jalón al pecho", muscle_group: "espalda", owner_id: null },
  { id: "4", name: "Press de banca con pausa", muscle_group: "pecho", owner_id: "u1" },
];

describe("searchCatalog", () => {
  it("matches every word ignoring accents and case, own exercises first", () => {
    expect(searchCatalog(entries, "PRESS banca", null).map((e) => e.id)).toEqual([
      "4",
      "1",
    ]);
    expect(searchCatalog(entries, "jalon", null).map((e) => e.id)).toEqual(["3"]);
  });

  it("filters by muscle group and sorts alphabetically", () => {
    expect(searchCatalog(entries, "", "pecho").map((e) => e.id)).toEqual([
      "4",
      "1",
      "2",
    ]);
  });
});

describe("findCatalogByName", () => {
  it("finds an exact name match after normalizing", () => {
    expect(findCatalogByName(entries, "  jalon AL pecho ")?.id).toBe("3");
    expect(findCatalogByName(entries, "Press")).toBeNull();
    expect(findCatalogByName(entries, "   ")).toBeNull();
  });
});

describe("muscleGroupLabel", () => {
  it("returns the Spanish label", () => {
    expect(muscleGroupLabel("core")).toBe("Abdomen / Core");
  });
});
