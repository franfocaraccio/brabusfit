import type { BrabusClient } from "./client";

export type StudentSummary = {
  id: string;
  name: string;
  email: string;
  routines: string[];
  /** ISO de su último entrenamiento finalizado, o null. */
  lastActivity: string | null;
};

type StudentShareRow = {
  shared_with_user_id: string | null;
  shared_with_email: string;
  student: { first_name: string; last_name: string } | null;
  routine: { id: string; name: string } | null;
};

/**
 * Alumnos del coach: usuarios con al menos una rutina compartida aceptada.
 * RLS limita las filas a las rutinas del coach y a las sesiones visibles.
 */
export async function getStudents(client: BrabusClient): Promise<StudentSummary[]> {
  const [sharesRes, sessionsRes] = await Promise.all([
    client
      .from("routine_shares")
      .select(
        "shared_with_user_id, shared_with_email, student:profiles!routine_shares_shared_with_user_id_fkey(first_name, last_name), routine:routines(id, name)",
      )
      .eq("status", "accepted"),
    client
      .from("workout_sessions")
      .select("user_id, finished_at")
      .eq("status", "finished")
      .order("finished_at", { ascending: false }),
  ]);

  const shares = (sharesRes.data ?? []) as unknown as StudentShareRow[];
  const sessions = (sessionsRes.data ?? []) as { user_id: string; finished_at: string | null }[];

  const lastByUser = new Map<string, string>();
  for (const s of sessions) {
    if (s.finished_at && !lastByUser.has(s.user_id)) lastByUser.set(s.user_id, s.finished_at);
  }

  const groups = new Map<string, StudentSummary>();
  for (const s of shares) {
    if (!s.shared_with_user_id) continue;
    const routineName = s.routine?.name;
    const existing = groups.get(s.shared_with_user_id);
    if (existing) {
      if (routineName) existing.routines.push(routineName);
      continue;
    }
    groups.set(s.shared_with_user_id, {
      id: s.shared_with_user_id,
      name: s.student
        ? `${s.student.first_name} ${s.student.last_name}`.trim()
        : s.shared_with_email,
      email: s.shared_with_email,
      routines: routineName ? [routineName] : [],
      lastActivity: lastByUser.get(s.shared_with_user_id) ?? null,
    });
  }
  return [...groups.values()];
}

export type StudentSetLog = { set_number: number; weight: number | null; reps: number | null };
export type StudentExerciseLog = {
  completed: boolean;
  note: string | null;
  exercise: { name: string } | null;
  set_logs: StudentSetLog[];
};
export type StudentSession = {
  id: string;
  finished_at: string | null;
  started_at: string;
  day: { name: string } | null;
  routine: { name: string } | null;
  exercise_logs: StudentExerciseLog[];
};

/** Datos del alumno + sus últimos 20 entrenamientos. Null si no existe o no hay acceso. */
export async function getStudentDetail(
  client: BrabusClient,
  studentId: string,
): Promise<{ name: string; sessions: StudentSession[] } | null> {
  const { data: student } = await client
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return null;

  const { data } = await client
    .from("workout_sessions")
    .select(
      "id, finished_at, started_at, day:routine_days(name), routine:routines(name), exercise_logs(completed, note, exercise:exercises(name), set_logs(set_number, weight, reps))",
    )
    .eq("user_id", studentId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(20);

  return {
    name: `${student.first_name} ${student.last_name}`.trim(),
    sessions: (data ?? []) as unknown as StudentSession[],
  };
}

/** Logs con algo para mostrar (series o detalle). */
export function visibleLogs(session: StudentSession): StudentExerciseLog[] {
  return session.exercise_logs.filter((l) => l.set_logs.length > 0 || l.note);
}
