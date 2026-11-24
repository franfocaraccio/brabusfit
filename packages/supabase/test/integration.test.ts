/**
 * Integración de las funciones de packages/supabase contra el Supabase local:
 * el mismo código que usan la web y la app mobile.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  copyPlan,
  copyRoutine,
  createCatalogEntry,
  createRoutine,
  deleteSession,
  getCatalog,
  getClient,
  getClientPlans,
  getClients,
  getCoachHome,
  getPlanDetail,
  getProfile,
  getProgressSessions,
  getRoutineDetail,
  getRoutineForEdit,
  getRoutineSessions,
  getRoutinesOverview,
  getSessionDetail,
  getStudentHome,
  getTrainingDay,
  isUsernameAvailable,
  saveClient,
  savePlan,
  saveWorkout,
  setCurrentPlan,
  setCurrentRoutine,
  updateProfile,
  updateRoutine,
  updateSession,
} from "../src";
import { EMPTY_CLIENT } from "@brabus/shared";
import {
  anyCatalogId,
  linkStudent,
  must,
  newUser,
  planInput,
  type TestUser,
} from "./helpers";

let coach: TestUser;
let student: TestUser;
let catalogId: string;
let clientId: string;
let routineId: string;
let dayId: string;
let exerciseId: string;

beforeAll(async () => {
  [coach, student] = await Promise.all([
    newUser("coach", "Carla"),
    newUser("student", "Andrés"),
  ]);
  catalogId = await anyCatalogId(coach.client);
  ({ clientId } = await linkStudent(coach, student));

  routineId = must(
    await createRoutine(coach.client, {
      name: "Fuerza",
      folderId: null,
      clientId,
      days: [
        {
          name: "Empuje",
          exercises: [
            { catalog_id: catalogId, sets_reps: "4x8", rest_seconds: 90, variant: "Barra" },
          ],
        },
        { name: "Tirón", exercises: [{ catalog_id: catalogId, sets_reps: "3x10" }] },
      ],
    }),
  ).id;
  const day = (await getRoutineDetail(student.client, routineId))!.days[0];
  dayId = day.id;
  const training = await getTrainingDay(student.client, {
    userId: student.id,
    routineId,
    dayId,
  });
  exerciseId = training!.exercises[0].id;
});

describe("perfil", () => {
  it("el registro crea el perfil con el rol y el usuario", async () => {
    const profile = await getProfile(coach.client, coach.id);
    expect(profile).toMatchObject({ first_name: "Carla", is_coach: true, onboarded: true });
    expect(await isUsernameAvailable(student.client, profile!.username!)).toBe(false);
    expect(await isUsernameAvailable(student.client, "libre_123_xyz")).toBe(true);
    expect(await isUsernameAvailable(student.client, "NO VALIDO")).toBe(false);
  });

  it("actualiza los datos editables con coma decimal", async () => {
    must(
      await updateProfile(student.client, {
        firstName: "Andrés",
        lastName: "Alumno",
        birthDate: "1998-02-20",
        heightCm: "180",
        weightKg: "78,5",
      }),
    );
    const profile = await getProfile(student.client, student.id);
    expect(profile).toMatchObject({ last_name: "Alumno", weight_kg: 78.5, height_cm: 180 });
  });
});

describe("clientes", () => {
  it("lista las fichas con su estado y la cantidad de rutinas", async () => {
    const clients = await getClients(coach.client, coach.id);
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({
      id: clientId,
      studentId: student.id,
      appAccess: "active",
      status: "linked",
      routineCount: 1,
    });
  });

  it("una ficha sin app no tiene cuenta vinculada", async () => {
    const { id } = must(
      await saveClient(coach.client, null, {
        ...EMPTY_CLIENT,
        first_name: "Roberto",
        height_cm: "175,5",
      }),
    );
    const detail = await getClient(coach.client, coach.id, id);
    expect(detail).toMatchObject({
      name: "Roberto",
      appAccess: "none",
      status: "unregistered",
      studentId: null,
    });
    expect(detail!.data.height_cm).toBe("175,5");
  });

  it("valida antes de ir a la base", async () => {
    const res = await saveClient(coach.client, null, EMPTY_CLIENT);
    expect(res).toEqual({ ok: false, error: "El cliente necesita un nombre." });
  });
});

describe("rutinas", () => {
  it("el coach las ve agrupadas por cliente y el alumno como 'de su coach'", async () => {
    const coachView = await getRoutinesOverview(coach.client, coach.id);
    expect(coachView.clients.map((c) => c.routines.map((r) => r.id))).toEqual([[routineId]]);
    expect(coachView.routines).toEqual([]);

    const studentView = await getRoutinesOverview(student.client, student.id);
    expect(studentView.fromCoaches.map((r) => [r.id, r.coachName])).toEqual([
      [routineId, "Carla Test"],
    ]);
  });

  it("guarda descanso y variante, y edita sin perderlos", async () => {
    const edit = await getRoutineForEdit(coach.client, routineId, coach.id);
    expect(edit!.days.map((d) => d.name)).toEqual(["Empuje", "Tirón"]);
    expect(edit!.days[0].exercises[0]).toMatchObject({
      sets_reps: "4x8",
      rest_seconds: 90,
      variant: "Barra",
    });
    // El alumno no puede abrirla para editar.
    expect(await getRoutineForEdit(student.client, routineId, student.id)).toBeNull();

    must(
      await updateRoutine(coach.client, routineId, {
        name: "Fuerza 2",
        folderId: null,
        days: edit!.days.map((d) => ({
          id: d.id,
          name: d.name,
          exercises: d.exercises.map((e) => ({
            id: e.id,
            catalog_id: e.catalog!.id,
            variant: e.variant,
            sets_reps: e.sets_reps,
            rest_seconds: e.rest_seconds,
          })),
        })),
      }),
    );
    const again = await getRoutineForEdit(coach.client, routineId, coach.id);
    expect(again!.name).toBe("Fuerza 2");
    expect(again!.days[0].exercises[0].rest_seconds).toBe(90);
  });

  it("copiar crea una plantilla independiente", async () => {
    const { id: copyId } = must(await copyRoutine(coach.client, routineId, null));
    const copy = await getRoutineForEdit(coach.client, copyId, coach.id);
    expect(copy!.clientName).toBeNull();
    expect(copy!.days.map((d) => d.name)).toEqual(["Empuje", "Tirón"]);

    // Cambiar la copia no toca la original.
    must(
      await updateRoutine(coach.client, copyId, {
        name: "Copia",
        folderId: null,
        newFolderName: "Plantillas",
        days: [{ name: "Único", exercises: [{ catalog_id: catalogId, sets_reps: "1x1" }] }],
      }),
    );
    const original = await getRoutineDetail(coach.client, routineId);
    expect(original!.days.map((d) => d.name)).toEqual(["Empuje", "Tirón"]);
  });

  it("la rutina vigente aparece en el inicio del alumno", async () => {
    must(await setCurrentRoutine(coach.client, routineId));
    const home = await getStudentHome(student.client, student.id);
    expect(home.routine).toMatchObject({ id: routineId, coachName: "Carla Test", dayCount: 2 });
  });
});

describe("entrenamiento e historial", () => {
  let sessionId: string;

  it("guarda la sesión con duración y variante, y precarga la próxima", async () => {
    const startedAt = new Date(Date.now() - 45 * 60_000).toISOString();
    must(
      await saveWorkout(
        student.client,
        routineId,
        dayId,
        [
          {
            exerciseId,
            note: "  Agarre cerrado  ",
            variant: "Barra",
            sets: [
              { set_number: 1, weight: 60, reps: 8 },
              { set_number: 2, weight: null, reps: null },
              { set_number: 3, weight: 62.5, reps: 6 },
            ],
          },
        ],
        startedAt,
      ),
    );

    const training = await getTrainingDay(student.client, {
      userId: student.id,
      routineId,
      dayId,
    });
    const ex = training!.exercises[0];
    expect(ex.restSeconds).toBe(90);
    expect(ex.history).toHaveLength(1);
    expect(ex.history[0]).toMatchObject({
      note: "Agarre cerrado",
      variant: "Barra",
      // Las series vacías no se guardan.
      sets: [
        { set_number: 1, weight: 60, reps: 8 },
        { set_number: 3, weight: 62.5, reps: 6 },
      ],
    });

    const sessions = await getRoutineSessions(student.client, {
      routineId,
      userId: student.id,
    });
    expect(sessions).toHaveLength(1);
    sessionId = sessions[0].id;
    const detail = await getSessionDetail(student.client, sessionId);
    expect(detail!.durationMs).toBeGreaterThan(44 * 60_000);
    expect(detail!.logs[0]).toMatchObject({ variant: "Barra", note: "Agarre cerrado" });
  });

  it("un inicio en el futuro se ignora (la sesión dura 0)", async () => {
    const otherDay = (await getRoutineDetail(student.client, routineId))!.days[1];
    const ex = (await getTrainingDay(student.client, {
      userId: student.id,
      routineId,
      dayId: otherDay.id,
    }))!.exercises[0];
    must(
      await saveWorkout(
        student.client,
        routineId,
        otherDay.id,
        [{ exerciseId: ex.id, note: null, variant: null, sets: [{ set_number: 1, weight: 10, reps: 10 }] }],
        new Date(Date.now() + 3_600_000).toISOString(),
      ),
    );
    const sessions = await getRoutineSessions(student.client, { routineId, userId: student.id });
    const latest = await getSessionDetail(student.client, sessions[0].id);
    expect(latest!.durationMs).toBeNull();
  });

  it("el coach ve el progreso del alumno", async () => {
    const progress = await getProgressSessions(coach.client, student.id);
    expect(progress).toHaveLength(2);
    expect(progress.flatMap((s) => s.entries.map((e) => e.catalogId))).toContain(catalogId);

    const home = await getCoachHome(coach.client, coach.id);
    expect(home.sessions.filter((s) => s.userId === student.id)).toHaveLength(2);
  });

  it("editar la sesión reemplaza series y detalle (todo o nada)", async () => {
    const detail = await getSessionDetail(student.client, sessionId);
    must(
      await updateSession(student.client, sessionId, [
        { log_id: detail!.logs[0].id, note: null, sets: [{ weight: 65, reps: 5 }] },
      ]),
    );
    const updated = await getSessionDetail(student.client, sessionId);
    expect(updated!.logs[0]).toMatchObject({
      note: null,
      // La variante no se toca si no se manda.
      variant: "Barra",
      sets: [{ set_number: 1, weight: 65, reps: 5 }],
    });

    // El coach no puede editarla.
    const byCoach = await updateSession(coach.client, sessionId, [
      { log_id: detail!.logs[0].id, note: "x", sets: [] },
    ]);
    expect(byCoach.ok).toBe(false);
  });

  it("solo quien entrenó puede borrar la sesión", async () => {
    expect((await deleteSession(coach.client, sessionId)).ok).toBe(false);
    must(await deleteSession(student.client, sessionId));
    expect(await getSessionDetail(student.client, sessionId)).toBeNull();
  });
});

describe("nutrición", () => {
  it("crea el plan del cliente, lo marca vigente y lo copia como plantilla", async () => {
    const { id: planId } = must(
      await savePlan(coach.client, null, planInput({ client_id: clientId })),
    );
    must(await setCurrentPlan(coach.client, planId));
    expect(await getClientPlans(coach.client, clientId)).toEqual([
      { id: planId, name: "Plan de prueba", isCurrent: true },
    ]);

    const detail = await getPlanDetail(student.client, planId);
    expect(detail!.meals[0].options[0].items[0]).toMatchObject({
      food: "Pollo",
      amount: "150",
      unit: "g",
      kcal: 247.5,
    });

    const home = await getStudentHome(student.client, student.id);
    expect(home.plan).toMatchObject({ id: planId, kcal: "2.500", meals: ["Almuerzo"] });

    const { id: templateId } = must(await copyPlan(coach.client, planId, null));
    const template = await getPlanDetail(coach.client, templateId);
    expect(template!.client).toBeNull();
    expect(await getPlanDetail(student.client, templateId)).toBeNull();
  });
});

describe("catálogo", () => {
  it("los ejercicios propios solo los ve quien los crea", async () => {
    const catalog = await getCatalog(coach.client, coach.id);
    const entry = must(
      await createCatalogEntry(coach.client, { name: "Press Brabus", muscleGroup: "pecho" }, catalog),
    );
    expect(entry.owner_id).toBe(coach.id);

    // Duplicado por nombre (sin tildes ni mayúsculas): no se crea otro.
    const dup = await createCatalogEntry(
      coach.client,
      { name: "press brabus", muscleGroup: "pecho" },
      await getCatalog(coach.client, coach.id),
    );
    expect(dup).toEqual({ ok: false, error: "Ese ejercicio ya existe en el catálogo." });

    const other = await newUser("coach", "Otro");
    const theirs = await getCatalog(other.client, other.id);
    expect(theirs.some((e) => e.id === entry.id)).toBe(false);
  });
});
