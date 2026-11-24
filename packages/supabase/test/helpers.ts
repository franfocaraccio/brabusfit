import { createClient } from "@supabase/supabase-js";
import { expect, inject } from "vitest";

import {
  EMPTY_CLIENT,
  emptyItem,
  type ActionResult,
  type Database,
  type PlanInput,
} from "@brabus/shared";

import {
  getMyCoaches,
  getUserId,
  inviteClient,
  respondInvitation,
  saveClient,
  signUp,
  type BrabusClient,
} from "../src";

/** Cliente con la clave pública y sin sesión guardada (como un usuario anónimo). */
export function anonClient(): BrabusClient {
  const { url, publishableKey } = inject("supabase");
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestUser = { client: BrabusClient; id: string; email: string };

// Cada corrida crea usuarios nuevos: los tests no dependen del seed y se
// pueden repetir sin resetear la base.
const run = Date.now().toString(36);
let counter = 0;

export async function newUser(
  role: "coach" | "student",
  firstName: string,
): Promise<TestUser> {
  const client = anonClient();
  const n = counter++;
  const email = `${role}-${run}-${n}@brabus.test`;
  const res = await signUp(client, {
    email,
    password: "test-password-123",
    username: `t${run}${n}`,
    firstName,
    lastName: "Test",
    birthDate: null,
    heightCm: "",
    weightKg: "",
    isCoach: role === "coach",
  });
  if (!res.ok) throw new Error(`signUp ${email}: ${res.error}`);
  expect(res.data.hasSession).toBe(true);
  const id = await getUserId(client);
  if (!id) throw new Error(`Sin sesión para ${email}`);
  return { client, id, email };
}

/** Desenvuelve un ActionResult o falla el test con el error. */
export function must<T>(res: ActionResult<T>): T {
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

/**
 * El coach crea la ficha del alumno, lo invita por email y el alumno acepta.
 * Devuelve la ficha (clientId) y el vínculo visto por el alumno (linkId).
 */
export async function linkStudent(
  coach: TestUser,
  student: TestUser,
): Promise<{ clientId: string; linkId: string }> {
  const { id: clientId } = must(
    await saveClient(coach.client, null, {
      ...EMPTY_CLIENT,
      first_name: "Alumno",
      email: student.email,
    }),
  );
  must(await inviteClient(coach.client, clientId, "email", student.email));
  const invitation = (await getMyCoaches(student.client, student.id)).find(
    (c) => c.coachId === coach.id,
  );
  if (!invitation) throw new Error("El alumno no ve la invitación");
  must(await respondInvitation(student.client, invitation.linkId, true));
  return { clientId, linkId: invitation.linkId };
}

/** Primer ejercicio del catálogo general (lo carga la migración 0008). */
export async function anyCatalogId(client: BrabusClient): Promise<string> {
  const { data, error } = await client
    .from("exercise_catalog")
    .select("id")
    .is("owner_id", null)
    .order("name")
    .limit(2);
  if (error || !data?.length) throw new Error("Catálogo vacío");
  return data[0].id;
}

export function planInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    name: "Plan de prueba",
    folder_id: null,
    guidelines: "",
    target_kcal: "2500",
    target_protein: "",
    target_carbs: "",
    target_fat: "",
    target_water_l: "",
    meals: [
      {
        name: "Almuerzo",
        time_label: "13:00",
        options: [
          {
            items: [
              { ...emptyItem(), food: "Pollo", amount: "150", kcal: "247,5" },
            ],
          },
        ],
      },
    ],
    ...over,
  };
}
