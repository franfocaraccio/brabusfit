import { describe, expect, it } from "vitest";

import { parseDecimal, sanitizeDecimal } from "./decimal";

describe("sanitizeDecimal", () => {
  it("keeps digits and the first separator only", () => {
    expect(sanitizeDecimal("12,5")).toBe("12,5");
    expect(sanitizeDecimal("12.5")).toBe("12.5");
    expect(sanitizeDecimal("1,2,3")).toBe("1,23");
    expect(sanitizeDecimal("1.2,3")).toBe("1.23");
  });

  it("drops letters, signs and spaces", () => {
    expect(sanitizeDecimal(" -7a5 kg")).toBe("75");
    expect(sanitizeDecimal("")).toBe("");
  });
});

describe("parseDecimal", () => {
  it("accepts comma or dot as decimal separator", () => {
    expect(parseDecimal("12,5")).toBe(12.5);
    expect(parseDecimal("12.5")).toBe(12.5);
    expect(parseDecimal(" 80 ")).toBe(80);
    expect(parseDecimal(",5")).toBe(0.5);
  });

  it("returns null for empty or invalid values", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
    expect(parseDecimal(".")).toBeNull();
    expect(parseDecimal(",")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("1,2,3")).toBeNull();
  });
});
