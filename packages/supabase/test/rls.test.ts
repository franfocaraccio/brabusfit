/**
 * Seguridad de la base (RLS + funciones SQL). La app mobile solo tiene la
 * clave pública, así que estas reglas son lo único que impide que un usuario
 * lea o cambie datos de otro. Todos los clientes usan esa misma clave.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { EMPTY_CLIENT } from "@brabus/shared";

import {
  copyRoutine,
  createRoutine,
  getTrainingDay,
  inviteClient,
  leaveCoach,
  removeClientAccess,
  saveClient,
  savePlan,
  saveWorkout,
  updateRoutine,
} from "../src";
import {
  anonClient,
  anyCatalogId,
  linkStudent,
  must,
  newUser,
  planInput,
  type TestUser,
} from "./helpers";

let coachA: TestUser;
let coachB: TestUser;
let student: TestUser;
let outsider: TestUser;

let catalogId: string;
let clientId: string;
let linkId: string;
let templateA: string;
let routineA: string;
let dayA: string;
let planA: string;
let routineB: string;
let sessionId: string;

const routineDays = (name: string) => [
  {
    name,
    exercises: [{ catalog_id: catalogId, sets_reps: "3x10" }],
  },
];

beforeAll(async () => {
  [coachA, coachB, student, outsider] = await Promise.all([
    newUser("coach", "CoachA"),
    newUser("coach", "CoachB"),
    newUser("student", "Alumno"),
    newUser("student", "Otro"),
  ]);
  catalogId = await anyCatalogId(coachA.client);

  ({ clientId, linkId } = await linkStudent(coachA, student));

  templateA = must(
    await createRoutine(coachA.client, {
      name: "Plantilla A",
      folderId: null,
      newFolderName: "Plantillas",
      days: routineDays("Día 1"),
    }),
  ).id;
  routineA = must(
    await createRoutine(coachA.client, {
      name: "Rutina del alumno",
      folderId: null,
      clientId,
      days: routineDays("Día 1"),
    }),
  ).id;
  planA = must(
    await savePlan(coachA.client, null, planInput({ client_id: clientId })),
  ).id;
  routineB = must(
    await createRoutine(coachB.client, {
      name: "Plantilla B",
      folderId: null,
      newFolderName: "Mías",
      days: routineDays("Día 1"),
    }),
  ).id;

  // El alumno entrena un día de su rutina.
  const training = await getTrainingDay(student.client, {
    userId: student.id,
    routineId: routineA,
    dayId: (
      await student.client
        .from("routine_days")
        .select("id")
        .eq("routine_id", routineA)
        .single()
    ).data!.id,
  });
  expect(training).not.toBeNull();
  dayA = training!.day.id;
  must(
    await saveWorkout(student.client, routineA, dayA, [
      {
        exerciseId: training!.exercises[0].id,
        note: null,
        variant: null,
        sets: [{ set_number: 1, weight: 40, reps: 10 }],
      },
    ]),
  );
  sessionId = (
    await student.client
      .from("workout_sessions")
      .select("id")
      .eq("user_id", student.id)
      .single()
  ).data!.id;
});

describe("un coach no ve ni toca datos de otro coach", () => {
  it("no ve sus clientes, rutinas, planes ni entrenamientos", async () => {
    const c = coachB.client;
    expect((await c.from("coach_students").select("id").eq("id", clientId)).data).toEqual([]);
    expect(
      (await c.from("routines").select("id").in("id", [routineA, templateA])).data,
    ).toEqual([]);
    expect((await c.from("routine_days").select("id").eq("routine_id", routineA)).data).toEqual(
      [],
    );
    expect((await c.from("nutrition_plans").select("id").eq("id", planA)).data).toEqual([]);
    expect((await c.from("workout_sessions").select("id").eq("id", sessionId)).data).toEqual([]);
    expect((await c.from("profiles").select("id").eq("id", student.id)).data).toEqual([]);
  });

  it("no puede editar, borrar ni copiar sus rutinas", async () => {
    const c = coachB.client;
    const upd = await c.from("routines").update({ name: "hackeada" }).eq("id", routineA).select();
    expect(upd.data).toEqual([]);
    await c.from("routines").delete().eq("id", routineA);

    const edit = await updateRoutine(c, routineA, {
      name: "hackeada",
      folderId: null,
      days: routineDays("Día 1"),
    });
    expect(edit.ok).toBe(false);
    expect((await copyRoutine(c, routineA, null)).ok).toBe(false);

    const { data } = await coachA.client.from("routines").select("name").eq("id", routineA).single();
    expect(data?.name).toBe("Rutina del alumno");
  });

  it("no puede crear rutinas a nombre de otro ni en fichas ajenas", async () => {
    const asOther = await coachB.client
      .from("routines")
      .insert({ name: "x", owner_id: coachA.id })
      .select();
    expect(asOther.error).not.toBeNull();

    const onForeignClient = await createRoutine(coachB.client, {
      name: "x",
      folderId: null,
      clientId,
      days: routineDays("Día 1"),
    });
    expect(onForeignClient.ok).toBe(false);
  });

  it("no puede editar planes ajenos", async () => {
    const res = await savePlan(coachB.client, planA, planInput({ name: "hackeado" }));
    expect(res.ok).toBe(false);
    const { data } = await coachA.client.from("nutrition_plans").select("name").eq("id", planA).single();
    expect(data?.name).toBe("Plan de prueba");
  });
});

describe("un alumno ve solo lo suyo", () => {
  it("ve la rutina y el plan que le armó su coach, no las plantillas", async () => {
    const c = student.client;
    expect((await c.from("routines").select("id")).data?.map((r) => r.id)).toEqual([routineA]);
    expect((await c.from("nutrition_plans").select("id")).data?.map((p) => p.id)).toEqual([
      planA,
    ]);
    expect((await c.from("nutrition_meals").select("id").eq("plan_id", planA)).data).toHaveLength(
      1,
    );
  });

  it("no lee las fichas del coach (notas privadas)", async () => {
    expect((await student.client.from("coach_students").select("id")).data).toEqual([]);
  });

  it("no puede editar la rutina del coach", async () => {
    const upd = await student.client
      .from("routines")
      .update({ name: "mía" })
      .eq("id", routineA)
      .select();
    expect(upd.data).toEqual([]);
    const ins = await student.client
      .from("routine_days")
      .insert({ routine_id: routineA, name: "Extra", position: 9 })
      .select();
    expect(ins.error).not.toBeNull();
  });

  it("no puede registrar entrenamientos en rutinas ajenas", async () => {
    const dayB = (
      await coachB.client.from("routine_days").select("id").eq("routine_id", routineB).single()
    ).data!.id;
    const res = await saveWorkout(student.client, routineB, dayB, [
      { exerciseId: "00000000-0000-0000-0000-000000000000", note: null, variant: null, sets: [] },
    ]);
    expect(res.ok).toBe(false);
  });

  it("otro alumno no ve sus rutinas, sesiones ni series", async () => {
    const c = outsider.client;
    expect((await c.from("routines").select("id")).data).toEqual([]);
    expect((await c.from("workout_sessions").select("id")).data).toEqual([]);
    expect((await c.from("exercise_logs").select("id")).data).toEqual([]);
    expect((await c.from("set_logs").select("id")).data).toEqual([]);
    expect((await c.from("nutrition_plans").select("id")).data).toEqual([]);

    const del = await c.from("workout_sessions").delete().eq("id", sessionId).select();
    expect(del.data).toEqual([]);
  });

  it("su coach ve sus entrenamientos mientras el vínculo está activo", async () => {
    const { data } = await coachA.client.from("workout_sessions").select("id").eq("id", sessionId);
    expect(data).toHaveLength(1);
    const { data: sets } = await coachA.client.from("set_logs").select("weight, reps");
    expect(sets).toEqual([{ weight: 40, reps: 10 }]);
  });
});

describe("un usuario anónimo no lee nada", () => {
  const tables = [
    "profiles",
    "coach_students",
    "folders",
    "routines",
    "routine_days",
    "exercises",
    "workout_sessions",
    "exercise_logs",
    "set_logs",
    "nutrition_folders",
    "nutrition_plans",
    "nutrition_meals",
    "nutrition_options",
    "nutrition_items",
  ] as const;

  it.each(tables)("%s", async (table) => {
    const { data } = await anonClient().from(table).select("*").limit(1);
    // Sin sesión: o no hay filas o el rol anónimo no tiene permiso.
    expect(data ?? []).toEqual([]);
  });

  it("no puede escribir ni llamar funciones protegidas", async () => {
    const anon = anonClient();
    const ins = await anon.from("routines").insert({ name: "x", owner_id: coachA.id });
    expect(ins.error).not.toBeNull();
    const rpc = await anon.rpc("copy_routine", { p_routine_id: routineA });
    expect(rpc.error).not.toBeNull();
  });
});

describe("al desvincularse, el alumno conserva sus rutinas (migración 0011)", () => {
  it("leave_coach: copia propia con sus entrenamientos; el coach conserva la suya", async () => {
    must(await leaveCoach(student.client, linkId));

    // El alumno ya no ve la del coach, pero tiene una copia propia.
    const { data: mine } = await student.client
      .from("routines")
      .select("id, name, owner_id, client_id");
    expect(mine).toHaveLength(1);
    expect(mine![0]).toMatchObject({
      name: "Rutina del alumno",
      owner_id: student.id,
      client_id: null,
    });
    expect(mine![0].id).not.toBe(routineA);

    // Sus entrenamientos se mudaron a la copia.
    const { data: session } = await student.client
      .from("workout_sessions")
      .select("routine_id")
      .eq("id", sessionId)
      .single();
    expect(session?.routine_id).toBe(mine![0].id);
    const { data: sets } = await student.client.from("set_logs").select("weight, reps");
    expect(sets).toEqual([{ weight: 40, reps: 10 }]);

    // También el plan de nutrición.
    const { data: plans } = await student.client.from("nutrition_plans").select("owner_id, name");
    expect(plans).toEqual([{ owner_id: student.id, name: "Plan de prueba" }]);

    // El coach conserva su rutina y la ficha, pero ya no ve los entrenamientos.
    const { data: coachRoutine } = await coachA.client
      .from("routines")
      .select("id")
      .eq("id", routineA);
    expect(coachRoutine).toHaveLength(1);
    const { data: link } = await coachA.client
      .from("coach_students")
      .select("status, student_id")
      .eq("id", clientId)
      .single();
    expect(link).toEqual({ status: "none", student_id: null });
    expect(
      (await coachA.client.from("workout_sessions").select("id").eq("id", sessionId)).data,
    ).toEqual([]);
  });

  it("remove_client_access del coach: mismo resultado", async () => {
    const other = await newUser("student", "Segundo");
    const link = await linkStudent(coachA, other);
    must(
      await createRoutine(coachA.client, {
        name: "Rutina 2",
        folderId: null,
        clientId: link.clientId,
        days: routineDays("Día 1"),
      }),
    );
    must(await removeClientAccess(coachA.client, link.clientId));

    const { data } = await other.client.from("routines").select("name, owner_id");
    expect(data).toEqual([{ name: "Rutina 2", owner_id: other.id }]);
  });

  it("cancelar una invitación pendiente no le deja nada", async () => {
    const invited = await newUser("student", "Invitado");
    const ficha = must(
      await saveClient(coachA.client, null, { ...EMPTY_CLIENT, first_name: "Sin aceptar" }),
    ).id;
    must(
      await createRoutine(coachA.client, {
        name: "Nunca vista",
        folderId: null,
        clientId: ficha,
        days: routineDays("Día 1"),
      }),
    );
    must(await inviteClient(coachA.client, ficha, "email", invited.email));

    // Pendiente: todavía no la ve.
    expect((await invited.client.from("routines").select("id")).data).toEqual([]);
    must(await removeClientAccess(coachA.client, ficha));
    expect((await invited.client.from("routines").select("id")).data).toEqual([]);
  });
});
