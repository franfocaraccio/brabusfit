import type { BrabusClient } from "./client";
import { fullName, type Person } from "./routines";

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

export type StudentHome = {
  /** Fechas ISO de las sesiones terminadas del último año (para las métricas). */
  finishedAt: string[];
  routine: HomeRoutine | null;
};

type SessionRow = {
  finished_at: string | null;
  routine_id: string;
  day: { name: string } | null;
};

/**
 * Datos del inicio del alumno: sus entrenamientos y la rutina activa (la que su
 * coach marcó vigente; si no hay, la última que entrenó y todavía puede ver).
 */
export async function getStudentHome(
  client: BrabusClient,
  userId: string,
): Promise<StudentHome> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const [sessionsRes, currentRes] = await Promise.all([
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

  if (!routine) return { finishedAt, routine: null };

  const { count } = await client
    .from("routine_days")
    .select("id", { count: "exact", head: true })
    .eq("routine_id", routine.id);

  return {
    finishedAt,
    routine: {
      id: routine.id,
      name: routine.name,
      coachName: fullName(routine.owner),
      dayCount: count ?? 0,
      lastDayName: sessions.find((s) => s.routine_id === routine.id)?.day?.name ?? null,
    },
  };
}
