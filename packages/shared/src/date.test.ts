import { describe, expect, it } from "vitest";

import {
  displayDateError,
  formatDisplayDate,
  maskDisplayDate,
  parseDisplayDate,
} from "./date";

describe("maskDisplayDate", () => {
  it("inserts slashes while typing", () => {
    expect(maskDisplayDate("2")).toBe("2");
    expect(maskDisplayDate("200")).toBe("20/0");
    expect(maskDisplayDate("20021998")).toBe("20/02/1998");
  });

  it("ignores non-digits and extra digits", () => {
    expect(maskDisplayDate("20/02/1998123")).toBe("20/02/1998");
    expect(maskDisplayDate("ab")).toBe("");
  });
});

describe("parseDisplayDate", () => {
  it("converts DD/MM/AAAA to ISO", () => {
    expect(parseDisplayDate("20/02/1998")).toBe("1998-02-20");
    expect(parseDisplayDate(" 29/02/2024 ")).toBe("2024-02-29");
  });

  it("rejects dates that do not exist or are incomplete", () => {
    expect(parseDisplayDate("29/02/2023")).toBeNull();
    expect(parseDisplayDate("31/04/2024")).toBeNull();
    expect(parseDisplayDate("2/2/1998")).toBeNull();
    expect(parseDisplayDate("")).toBeNull();
  });
});

describe("formatDisplayDate", () => {
  it("converts ISO to DD/MM/AAAA", () => {
    expect(formatDisplayDate("1998-02-20")).toBe("20/02/1998");
    expect(formatDisplayDate("1998-02-20T10:00:00Z")).toBe("20/02/1998");
  });

  it("returns an empty string without a date", () => {
    expect(formatDisplayDate(null)).toBe("");
    expect(formatDisplayDate(undefined)).toBe("");
    expect(formatDisplayDate("garbage")).toBe("");
  });
});

describe("displayDateError", () => {
  it("treats an empty optional date as valid", () => {
    expect(displayDateError("")).toBeNull();
    expect(displayDateError("  ")).toBeNull();
  });

  it("explains format and existence errors", () => {
    expect(displayDateError("20-02-1998")).toBe("Usá el formato DD/MM/AAAA.");
    expect(displayDateError("30/02/1998")).toBe("Esa fecha no existe.");
    expect(displayDateError("20/02/1998")).toBeNull();
  });
});
