import { describe, expect, it } from "vitest";

import {
  ageFrom,
  clientStatus,
  EMPTY_CLIENT,
  goalLabel,
  levelLabel,
  normalizeClient,
  sexLabel,
  validateClient,
} from "./clients";

describe("labels", () => {
  it("maps stored values to Spanish labels", () => {
    expect(goalLabel("ganar_masa")).toBe("Ganar masa muscular");
    expect(levelLabel("avanzado")).toBe("Avanzado");
    expect(sexLabel("femenino")).toBe("Femenino");
    expect(goalLabel(null)).toBeNull();
  });
});

describe("clientStatus", () => {
  it("derives the app status from access and account", () => {
    expect(clientStatus("active", true)).toBe("linked");
    expect(clientStatus("pending", true)).toBe("invited");
    expect(clientStatus("pending", false)).toBe("unregistered");
    expect(clientStatus("none", false)).toBe("unregistered");
  });
});

describe("ageFrom", () => {
  const today = new Date(2026, 9, 21);
  it("counts full years until the birthday", () => {
    expect(ageFrom("1998-10-21", today)).toBe(28);
    expect(ageFrom("1998-10-22", today)).toBe(27);
    expect(ageFrom("1998-11-01", today)).toBe(27);
  });

  it("returns null for missing, malformed or future dates", () => {
    expect(ageFrom(null, today)).toBeNull();
    expect(ageFrom("1998-10", today)).toBeNull();
    expect(ageFrom("2030-01-01", today)).toBeNull();
  });
});

describe("validateClient", () => {
  const client = { ...EMPTY_CLIENT, first_name: "Ana" };

  it("only requires a first name", () => {
    expect(validateClient(client)).toBeNull();
    expect(validateClient(EMPTY_CLIENT)).toBe("El cliente necesita un nombre.");
  });

  it("checks optional email, height, weight and birth date", () => {
    expect(validateClient({ ...client, email: "ana@" })).toBe("Revisá el email.");
    expect(validateClient({ ...client, height_cm: "1,70m" })).toBe(
      "Revisá la estatura.",
    );
    expect(validateClient({ ...client, initial_weight_kg: "abc" })).toBe(
      "Revisá el peso inicial.",
    );
    expect(validateClient({ ...client, birth_date: "2999-01-01" })).toBe(
      "Revisá la fecha de nacimiento.",
    );
    expect(
      validateClient({
        ...client,
        email: "ana@mail.com",
        height_cm: "168",
        initial_weight_kg: "62,5",
        birth_date: "1990-05-10",
      }),
    ).toBeNull();
  });
});

describe("normalizeClient", () => {
  it("trims text, lowercases the email and converts decimal commas", () => {
    expect(
      normalizeClient({
        ...EMPTY_CLIENT,
        first_name: " Ana ",
        email: " Ana@Mail.COM ",
        height_cm: "168,5",
        initial_weight_kg: " 62,5 ",
        notes: " Entrena a la mañana ",
      }),
    ).toMatchObject({
      first_name: "Ana",
      email: "ana@mail.com",
      height_cm: "168.5",
      initial_weight_kg: "62.5",
      notes: "Entrena a la mañana",
    });
  });
});
