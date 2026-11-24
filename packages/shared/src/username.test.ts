import { describe, expect, it } from "vitest";

import { usernameError } from "./username";

describe("usernameError", () => {
  it("accepts lowercase letters, digits, dot and underscore", () => {
    expect(usernameError("coach_test")).toBeNull();
    expect(usernameError("ana.p99")).toBeNull();
  });

  it("normalizes case and surrounding spaces before validating", () => {
    expect(usernameError("  Coach_Test ")).toBeNull();
  });

  it("enforces length limits", () => {
    expect(usernameError("ab")).toBe("Mínimo 3 caracteres.");
    expect(usernameError("a".repeat(21))).toBe("Máximo 20 caracteres.");
  });

  it("rejects other characters", () => {
    expect(usernameError("ana-p")).toBe(
      "Solo minúsculas, números, punto y guión bajo.",
    );
    expect(usernameError("josé")).toBe(
      "Solo minúsculas, números, punto y guión bajo.",
    );
  });
});
