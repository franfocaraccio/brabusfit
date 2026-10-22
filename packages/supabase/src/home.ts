import { dayRange, formatRange } from "@brabus/shared";

import type { BrabusClient } from "./client";
import {
  CLIENT_NAME_SELECT,
  clientName,
  fullName,
  type ClientNameRow,
  type Person,
} from "./routines";

/** Rutina que se muestra en el inicio del alumno ("Tu rutina"). */
export type HomeRoutine = {
  id: string;
  name: string;
  coachName: string | null;
  /** Días de la rutina: es el objetivo semanal. */
  dayCount: number;
  /** Nombre del último día que entrenó de esta rutina, o null. */
  lastDayName: string | null;
};

/** Plan de nutrición que se muestra en el inicio del alumno ("Tu plan"). */
export type HomePlan = {
  id: string;
  name: string;
  coachName: string | null;
  /** "2.800" o "2.750–2.850" (objetivo cargado, o la suma de las comidas). */
  kcal: string | null;
  /** Gramos de macros (objetivos, o el promedio de las comidas). */
  macros: { protein: number; carbs: number; fat: number } | null;
  meals: string[];
};

export type StudentHome = {
  /** Fechas ISO de las sesiones terminadas del último año (para las métricas). */
  finishedAt: string[];
  routine: HomeRoutine | null;
  plan: HomePlan | null;
};

type PlanRow = {
  id: string;
  name: string;
  target_kcal: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  owner: Person | null;
  meals: {
    name: string;
    position: number;
    options: { items: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }[] }[];
  }[];
};

/** Plan del alumno: el vigente, o si no hay, el último que le armó un coach. */
async function getHomePlan(client: BrabusClient, userId: string): Promise<HomePlan | null> {
  // RLS: solo los de coaches con acceso activo.
  const { data } = await client
    .from("nutrition_plans")
    .select(
      "id, name, target_kcal, target_protein, target_carbs, target_fat, owner:profiles!nutrition_plans_owner_id_fkey(first_name, last_name), meals:nutrition_meals(name, position, options:nutrition_options(items:nutrition_items(kcal, protein, carbs, fat)))",
    )
    .neq("owner_id", userId)
    .order("is_current", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  const p = ((data ?? []) as unknown as PlanRow[])[0];
  if (!p) return null;

  const meals = [...p.meals].sort((a, b) => a.position - b.position);
  const range = dayRange(meals);
  const mid = (k: "protein" | "carbs" | "fat") => (range.min[k] + range.max[k]) / 2;
  const targets =
    p.target_protein !== null && p.target_carbs !== null && p.target_fat !== null
      ? { protein: p.target_protein, carbs: p.target_carbs, fat: p.target_fat }
      : null;

  return {
    id: p.id,
    name: p.name,
    coachName: fullName(p.owner),
    kcal:
      p.target_kcal !== null
        ? p.target_kcal.toLocaleString("es-AR", { maximumFractionDigits: 0 })
        : range.hasData
          ? formatRange(range, "kcal")
          : null,
    macros: targets ?? (range.hasData ? { protein: mid("protein"), carbs: mid("carbs"), fat: mid("fat") } : null),
    meals: meals.map((m) => m.name),
  };
}

type SessionRow = {
  finished_at: string | null;
  routine_id: string;
  day: { name: string } | null;
};

/**
 * Datos del inicio del alumno: sus entrenamientos, la rutina activa (la que su
 * coach marcó vigente; si no hay, la última que entrenó y todavía puede ver) y su
 * plan de nutrición.
 */
export async function getStudentHome(
  client: BrabusClient,
  userId: string,
): Promise<StudentHome> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const [sessionsRes, currentRes, plan] = await Promise.all([
    client
      .from("workout_sessions")
      .select("finished_at, routine_id, day:routine_days(name)")
      .eq("user_id", userId)
      .eq("status", "finished")
      .gte("finished_at", since.toISOString())
      .order("finished_at", { ascending: false }),
    // RLS: solo las de coaches con acceso activo.
    client
      .from("routines")
      .select("id, name, owner:profiles!routines_owner_id_fkey(first_name, last_name)")
      .eq("is_current", true)
      .neq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1),
    getHomePlan(client, userId),
  ]);

  const sessions = (sessionsRes.data ?? []) as unknown as SessionRow[];
  const finishedAt = sessions.flatMap((s) => (s.finished_at ? [s.finished_at] : []));

  type RoutineRow = { id: string; name: string; owner: Person | null };
  let routine: RoutineRow | null = ((currentRes.data ?? []) as unknown as RoutineRow[])[0] ?? null;

  // Sin rutina vigente: la última que entrenó (si todavía la puede ver).
  if (!routine && sessions.length > 0) {
    const ids = [...new Set(sessions.map((s) => s.routine_id))];
    const { data } = await client
      .from("routines")
      .select("id, name, owner:profiles!routines_owner_id_fkey(first_name, last_name)")
      .in("id", ids);
    const visible = new Map(((data ?? []) as unknown as RoutineRow[]).map((r) => [r.id, r]));
    const lastId = ids.find((id) => visible.has(id));
    routine = lastId ? visible.get(lastId)! : null;
  }

  if (!routine) return { finishedAt, routine: null, plan };

  const { count } = await client
    .from("routine_days")
    .select("id", { count: "exact", head: true })
    .eq("routine_id", routine.id);

  return {
    finishedAt,
    plan,
    routine: {
      id: routine.id,
      name: routine.name,
      coachName: fullName(routine.owner),
      dayCount: count ?? 0,
      lastDayName: sessions.find((s) => s.routine_id === routine.id)?.day?.name ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Inicio del coach
// ---------------------------------------------------------------------------

export type CoachHomeClient = {
  id: string;
  name: string;
  /** Cuenta vinculada con acceso activo (puede entrenar con la app). */
  studentId: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type CoachHome = {
  /** Todas las fichas, archivadas incluidas (para la evolución de clientes). */
  clients: CoachHomeClient[];
  /** Clientes activos sin rutina vigente / sin plan vigente. */
  noRoutine: { id: string; name: string }[];
  noPlan: { id: string; name: string }[];
  /** Entrenamientos de sus clientes en sus rutinas, de los últimos 8 días. */
  sessions: { userId: string; finishedAt: string }[];
};

/** Datos del inicio del coach: pendientes, quién entrenó y sus clientes. */
export async function getCoachHome(client: BrabusClient, coachId: string): Promise<CoachHome> {
  const since = new Date();
  since.setDate(since.getDate() - 8);

  const [clientsRes, routinesRes, plansRes, sessionsRes] = await Promise.all([
    client
      .from("coach_students")
      .select(`${CLIENT_NAME_SELECT}, created_at`)
      .eq("coach_id", coachId),
    client
      .from("routines")
      .select("client_id")
      .eq("owner_id", coachId)
      .eq("is_current", true),
    client
      .from("nutrition_plans")
      .select("client_id")
      .eq("owner_id", coachId)
      .eq("is_current", true),
    // RLS: solo las de alumnos con vínculo activo.
    client
      .from("workout_sessions")
      .select("user_id, finished_at, routine:routines!inner(owner_id)")
      .eq("status", "finished")
      .eq("routine.owner_id", coachId)
      .neq("user_id", coachId)
      .gte("finished_at", since.toISOString()),
  ]);

  const rows = (clientsRes.data ?? []) as unknown as (ClientNameRow & { created_at: string })[];
  const clients = rows
    .map((c) => ({
      id: c.id,
      name: clientName(c),
      studentId: c.status === "active" ? c.student_id : null,
      createdAt: c.created_at,
      archivedAt: c.archived_at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const withRoutine = new Set((routinesRes.data ?? []).map((r) => r.client_id));
  const withPlan = new Set((plansRes.data ?? []).map((p) => p.client_id));
  const active = clients.filter((c) => c.archivedAt === null);

  return {
    clients,
    noRoutine: active.filter((c) => !withRoutine.has(c.id)).map(({ id, name }) => ({ id, name })),
    noPlan: active.filter((c) => !withPlan.has(c.id)).map(({ id, name }) => ({ id, name })),
    sessions: (sessionsRes.data ?? []).flatMap((s) =>
      s.finished_at ? [{ userId: s.user_id, finishedAt: s.finished_at }] : [],
    ),
  };
}
