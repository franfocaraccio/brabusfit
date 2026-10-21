import {
  fail,
  ok,
  type ActionResult,
  type AddStudentStatus,
  type LinkStatus,
} from "@brabus/shared";

import type { BrabusClient } from "./client";

// ---------------------------------------------------------------------------
// Coach: sus alumnos
// ---------------------------------------------------------------------------

export type StudentSummary = {
  /** Id del vínculo coach ↔ alumno (para compartir / desvincular). */
  linkId: string;
  /** null mientras el email invitado no tiene cuenta. */
  studentId: string | null;
  name: string;
  email: string;
  username: string | null;
  status: LinkStatus;
  /** Rutinas que el coach le armó. */
  routineCount: number;
  /** ISO de su último entrenamiento finalizado (solo con vínculo activo), o null. */
  lastActivity: string | null;
};

type LinkRow = {
  id: string;
  student_id: string | null;
  student_email: string;
  status: LinkStatus;
  student: { first_name: string; last_name: string; username: string | null } | null;
};

const personName = (p: { first_name: string; last_name: string } | null, fallback: string) =>
  p ? `${p.first_name} ${p.last_name}`.trim() || fallback : fallback;

/** Alumnos del coach (activos y con invitación pendiente). */
export async function getStudents(
  client: BrabusClient,
  coachId: string,
): Promise<StudentSummary[]> {
  const [linksRes, routinesRes, sessionsRes] = await Promise.all([
    client
      .from("coach_students")
      .select(
        "id, student_id, student_email, status, student:profiles!coach_students_student_id_fkey(first_name, last_name, username)",
      )
      .eq("coach_id", coachId)
      .order("created_at", { ascending: false }),
    client
      .from("routines")
      .select("student_email")
      .eq("owner_id", coachId)
      .not("student_email", "is", null),
    client
      .from("workout_sessions")
      .select("user_id, finished_at")
      .eq("status", "finished")
      .neq("user_id", coachId)
      .order("finished_at", { ascending: false }),
  ]);

  const routinesByEmail = new Map<string, number>();
  for (const r of routinesRes.data ?? []) {
    const k = (r.student_email ?? "").toLowerCase();
    routinesByEmail.set(k, (routinesByEmail.get(k) ?? 0) + 1);
  }
  const lastByUser = new Map<string, string>();
  for (const s of sessionsRes.data ?? []) {
    if (s.finished_at && !lastByUser.has(s.user_id)) lastByUser.set(s.user_id, s.finished_at);
  }

  return ((linksRes.data ?? []) as unknown as LinkRow[]).map((l) => ({
    linkId: l.id,
    studentId: l.student_id,
    name: personName(l.student, l.student_email),
    email: l.student_email,
    username: l.student?.username ?? null,
    status: l.status,
    routineCount: routinesByEmail.get(l.student_email.toLowerCase()) ?? 0,
    lastActivity: l.student_id ? (lastByUser.get(l.student_id) ?? null) : null,
  }));
}

/** Validación en vivo al escribir el usuario o email del alumno a agregar. */
export async function checkAddStudent(
  client: BrabusClient,
  mode: "email" | "username",
  value: string,
): Promise<AddStudentStatus | null> {
  const { data, error } = await client.rpc("validate_add_student", {
    p_mode: mode,
    p_value: value,
  });
  if (error) return null;
  return data as AddStudentStatus;
}

/** Agrega un alumno: queda con invitación pendiente hasta que la acepte. */
export async function addStudent(
  client: BrabusClient,
  mode: "email" | "username",
  value: string,
): Promise<ActionResult<{ id: string; existed: boolean; email: string }>> {
  const { data, error } = await client.rpc("add_student", { p_mode: mode, p_value: value });
  if (error) return fail(error.message);
  return ok(data as { id: string; existed: boolean; email: string });
}

/**
 * Desvincula un alumno (o cancela su invitación). Las rutinas que le armó le
 * quedan guardadas al coach; el alumno deja de verlas.
 */
export async function unlinkStudent(client: BrabusClient, linkId: string): Promise<ActionResult> {
  const { error } = await client.rpc("unlink_student", { p_link_id: linkId });
  if (error) return fail(error.message);
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Coach: detalle de un alumno
// ---------------------------------------------------------------------------

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

export type StudentDetail = {
  name: string;
  email: string;
  username: string | null;
  link: { id: string; status: LinkStatus };
  /** Rutinas que el coach le armó. */
  routines: { id: string; name: string }[];
  /** Últimos 20 entrenamientos (solo con vínculo activo). */
  sessions: StudentSession[];
};

/** Alumno vinculado al coach. Null si no es su alumno. */
export async function getStudentDetail(
  client: BrabusClient,
  coachId: string,
  studentId: string,
): Promise<StudentDetail | null> {
  const { data: link } = await client
    .from("coach_students")
    .select(
      "id, status, student_email, student:profiles!coach_students_student_id_fkey(first_name, last_name, username)",
    )
    .eq("coach_id", coachId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!link) return null;
  const l = link as unknown as {
    id: string;
    status: LinkStatus;
    student_email: string;
    student: { first_name: string; last_name: string; username: string | null } | null;
  };

  const [routinesRes, sessionsRes] = await Promise.all([
    client
      .from("routines")
      .select("id, name")
      .eq("owner_id", coachId)
      .eq("student_id", studentId)
      .order("name"),
    client
      .from("workout_sessions")
      .select(
        "id, finished_at, started_at, day:routine_days(name), routine:routines(name), exercise_logs(completed, note, exercise:exercises(name), set_logs(set_number, weight, reps))",
      )
      .eq("user_id", studentId)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(20),
  ]);

  return {
    name: personName(l.student, l.student_email),
    email: l.student_email,
    username: l.student?.username ?? null,
    link: { id: l.id, status: l.status },
    routines: (routinesRes.data ?? []) as { id: string; name: string }[],
    sessions: (sessionsRes.data ?? []) as unknown as StudentSession[],
  };
}

/** Logs con algo para mostrar (series o detalle). */
export function visibleLogs(session: StudentSession): StudentExerciseLog[] {
  return session.exercise_logs.filter((l) => l.set_logs.length > 0 || l.note);
}

// ---------------------------------------------------------------------------
// Alumno: sus coaches e invitaciones
// ---------------------------------------------------------------------------

export type MyCoach = {
  linkId: string;
  coachId: string;
  name: string;
  username: string | null;
  status: LinkStatus;
  createdAt: string;
};

/** Coaches del alumno: activos e invitaciones pendientes. */
export async function getMyCoaches(client: BrabusClient, studentId: string): Promise<MyCoach[]> {
  const { data } = await client
    .from("coach_students")
    .select(
      "id, coach_id, status, created_at, coach:profiles!coach_students_coach_id_fkey(first_name, last_name, username)",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  return (
    (data ?? []) as unknown as {
      id: string;
      coach_id: string;
      status: LinkStatus;
      created_at: string;
      coach: { first_name: string; last_name: string; username: string | null } | null;
    }[]
  ).map((c) => ({
    linkId: c.id,
    coachId: c.coach_id,
    name: personName(c.coach, "Coach"),
    username: c.coach?.username ?? null,
    status: c.status,
    createdAt: c.created_at,
  }));
}

/** Aceptar o rechazar una invitación. Si rechaza, no ve lo que el coach le armó. */
export async function respondInvitation(
  client: BrabusClient,
  linkId: string,
  accept: boolean,
): Promise<ActionResult> {
  const { error } = await client.rpc("respond_invitation", {
    p_link_id: linkId,
    p_accept: accept,
  });
  if (error) return fail(error.message);
  return ok(undefined);
}

/** El alumno se desvincula de un coach y deja de ver todo lo que ese coach le armó. */
export async function leaveCoach(client: BrabusClient, linkId: string): Promise<ActionResult> {
  const { error } = await client.rpc("leave_coach", { p_link_id: linkId });
  if (error) return fail(error.message);
  return ok(undefined);
}
