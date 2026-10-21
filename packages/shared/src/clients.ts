import type { AppAccess, ClientGoal, ClientLevel, ClientSex } from "./database";

/** Datos de la ficha de un cliente (lo que carga el coach). Strings vacíos = sin dato. */
export type ClientInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** YYYY-MM-DD */
  birth_date: string;
  sex: ClientSex | "";
  height_cm: string;
  initial_weight_kg: string;
  goal: ClientGoal | "";
  level: ClientLevel | "";
  injuries: string;
  notes: string;
};

export const EMPTY_CLIENT: ClientInput = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birth_date: "",
  sex: "",
  height_cm: "",
  initial_weight_kg: "",
  goal: "",
  level: "",
  injuries: "",
  notes: "",
};

export const CLIENT_SEXES: { value: ClientSex; label: string }[] = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "otro", label: "Otro" },
];

export const CLIENT_GOALS: { value: ClientGoal; label: string }[] = [
  { value: "bajar_peso", label: "Bajar de peso" },
  { value: "ganar_masa", label: "Ganar masa muscular" },
  { value: "tonificar", label: "Tonificar" },
  { value: "rendimiento", label: "Rendimiento" },
  { value: "salud", label: "Salud / bienestar" },
  { value: "otro", label: "Otro" },
];

export const CLIENT_LEVELS: { value: ClientLevel; label: string }[] = [
  { value: "principiante", label: "Principiante" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
];

const labelOf = <T extends string>(list: { value: T; label: string }[], v: T | null | undefined) =>
  list.find((o) => o.value === v)?.label ?? null;

export const sexLabel = (v: ClientSex | null | undefined) => labelOf(CLIENT_SEXES, v);
export const goalLabel = (v: ClientGoal | null | undefined) => labelOf(CLIENT_GOALS, v);
export const levelLabel = (v: ClientLevel | null | undefined) => labelOf(CLIENT_LEVELS, v);

export const APP_ACCESS_LABEL: Record<AppAccess, string> = {
  none: "Sin app",
  pending: "Invitación pendiente",
  active: "Con app",
};

/** Edad en años a partir de YYYY-MM-DD (null si no hay fecha). */
export function ageFrom(birthDate: string | null | undefined, today = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

const NUM = /^\d+([.,]\d+)?$/;

/** Mensaje de error de la ficha, o null si es válida. */
export function validateClient(input: ClientInput): string | null {
  if (!input.first_name.trim()) return "El cliente necesita un nombre.";
  const email = input.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Revisá el email.";
  if (input.height_cm.trim() && !NUM.test(input.height_cm.trim())) return "Revisá la estatura.";
  if (input.initial_weight_kg.trim() && !NUM.test(input.initial_weight_kg.trim())) {
    return "Revisá el peso inicial.";
  }
  if (input.birth_date && ageFrom(input.birth_date) === null) return "Revisá la fecha de nacimiento.";
  return null;
}

/** Normaliza la ficha para guardarla (coma decimal → punto, espacios). */
export function normalizeClient(input: ClientInput): ClientInput {
  const num = (s: string) => s.trim().replace(",", ".");
  return {
    ...input,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    height_cm: num(input.height_cm),
    initial_weight_kg: num(input.initial_weight_kg),
    injuries: input.injuries.trim(),
    notes: input.notes.trim(),
  };
}
