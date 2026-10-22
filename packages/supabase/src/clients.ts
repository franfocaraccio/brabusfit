import {
  fail,
  normalizeClient,
  ok,
  validateClient,
  type ActionResult,
  clientStatus,
  type AppAccess,
  type ClientInput,
  type ClientStatus,
  type InviteStatus,
  type LinkStatus,
  type Tables,
} from "@brabus/shared";

import type { BrabusClient } from "./client";

// ---------------------------------------------------------------------------
// Coach: fichas de sus clientes
// ---------------------------------------------------------------------------

type ClientRow = Tables<"coach_students">;
type AccountProfile = { first_name: string; last_name: string; username: string | null };

const fullName = (first: string, last: string) => `${first} ${last}`.trim();

/** Nombre visible: el de la ficha, o el de su cuenta, o el email. */
function displayName(row: Pick<ClientRow, "first_name" | "last_name" | "student_email">, account: AccountProfile | null) {
  return (
    fullName(row.first_name, row.last_name) ||
    (account ? fullName(account.first_name, account.last_name) : "") ||
    row.student_email ||
    "Cliente"
  );
}

export type ClientSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Cuenta vinculada (con app o invitado con cuenta). */
  studentId: string | null;
  username: string | null;
  appAccess: AppAccess;
  /** Vinculado / Invitación pendiente / Usuario no registrado / Sin invitar. */
  status: ClientStatus;
  archived: boolean;
  /** Rutinas que el coach le armó. */
  routineCount: number;
  /** ISO de su último entrenamiento (solo con app), o null. */
  lastActivity: string | null;
};

const CLIENT_SELECT =
  "*, account:profiles!coach_students_student_id_fkey(first_name, last_name, username)";

/** Todas las fichas del coach (activas y archivadas). */
export async function getClients(client: BrabusClient, coachId: string): Promise<ClientSummary[]> {
  const [clientsRes, routinesRes, sessionsRes] = await Promise.all([
    client
      .from("coach_students")
      .select(CLIENT_SELECT)
      .eq("coach_id", coachId)
      .order("first_name")
      .order("last_name"),
    client
      .from("routines")
      .select("client_id")
      .eq("owner_id", coachId)
      .not("client_id", "is", null),
    client
      .from("workout_sessions")
      .select("user_id, finished_at")
      .eq("status", "finished")
      .neq("user_id", coachId)
      .order("finished_at", { ascending: false }),
  ]);

  const routineCount = new Map<string, number>();
  for (const r of routinesRes.data ?? []) {
    if (r.client_id) routineCount.set(r.client_id, (routineCount.get(r.client_id) ?? 0) + 1);
  }
  const lastByUser = new Map<string, string>();
  for (const s of sessionsRes.data ?? []) {
    if (s.finished_at && !lastByUser.has(s.user_id)) lastByUser.set(s.user_id, s.finished_at);
  }

  return ((clientsRes.data ?? []) as unknown as (ClientRow & { account: AccountProfile | null })[])
    .map((c) => ({
      id: c.id,
      name: displayName(c, c.account),
      email: c.student_email,
      phone: c.phone,
      studentId: c.student_id,
      username: c.account?.username ?? null,
      appAccess: c.status,
      status: clientStatus(c.status, c.student_id !== null),
      archived: c.archived_at !== null,
      routineCount: routineCount.get(c.id) ?? 0,
      lastActivity:
        c.status === "active" && c.student_id ? (lastByUser.get(c.student_id) ?? null) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
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

export type ClientDetail = {
  id: string;
  name: string;
  /** Datos de la ficha (para mostrar y editar). */
  data: ClientInput;
  username: string | null;
  studentId: string | null;
  appAccess: AppAccess;
  status: ClientStatus;
  archived: boolean;
  createdAt: string;
  /** Rutinas que el coach le armó. */
  routines: { id: string; name: string }[];
  /** Últimos 20 entrenamientos (solo con la app activa). */
  sessions: StudentSession[];
};

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** Ficha completa del cliente. Null si no existe o no es del coach. */
export async function getClient(
  client: BrabusClient,
  coachId: string,
  clientId: string,
): Promise<ClientDetail | null> {
  const { data } = await client
    .from("coach_students")
    .select(CLIENT_SELECT)
    .eq("id", clientId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!data) return null;
  const c = data as unknown as ClientRow & { account: AccountProfile | null };

  const [routinesRes, sessionsRes] = await Promise.all([
    client.from("routines").select("id, name").eq("client_id", c.id).order("name"),
    c.status === "active" && c.student_id
      ? client
          .from("workout_sessions")
          .select(
            "id, finished_at, started_at, day:routine_days(name), routine:routines(name), exercise_logs(completed, note, exercise:exercises(name), set_logs(set_number, weight, reps))",
          )
          .eq("user_id", c.student_id)
          .eq("status", "finished")
          .order("finished_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    id: c.id,
    name: displayName(c, c.account),
    data: {
      first_name: c.first_name,
      last_name: c.last_name,
      email: str(c.student_email),
      phone: str(c.phone),
      birth_date: str(c.birth_date),
      sex: c.sex ?? "",
      height_cm: str(c.height_cm).replace(".", ","),
      initial_weight_kg: str(c.initial_weight_kg).replace(".", ","),
      goal: c.goal ?? "",
      level: c.level ?? "",
      injuries: str(c.injuries),
      notes: str(c.notes),
    },
    username: c.account?.username ?? null,
    studentId: c.student_id,
    appAccess: c.status,
    status: clientStatus(c.status, c.student_id !== null),
    archived: c.archived_at !== null,
    createdAt: c.created_at,
    routines: (routinesRes.data ?? []) as { id: string; name: string }[],
    sessions: (sessionsRes.data ?? []) as unknown as StudentSession[],
  };
}

/** Ficha del coach que corresponde a una cuenta de alumno (para links desde una sesión). */
export async function getClientIdForStudent(
  client: BrabusClient,
  coachId: string,
  studentId: string,
): Promise<string | null> {
  const { data } = await client
    .from("coach_students")
    .select("id")
    .eq("coach_id", coachId)
    .eq("student_id", studentId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Logs con algo para mostrar (series o detalle). */
export function visibleLogs(session: StudentSession): StudentExerciseLog[] {
  return session.exercise_logs.filter((l) => l.set_logs.length > 0 || l.note);
}

/** Crea (id null) o actualiza la ficha. */
export async function saveClient(
  client: BrabusClient,
  clientId: string | null,
  input: ClientInput,
): Promise<ActionResult<{ id: string }>> {
  const invalid = validateClient(input);
  if (invalid) return fail(invalid);
  const { data, error } = await client.rpc("save_client", {
    p_id: clientId,
    p_data: normalizeClient(input),
  });
  if (error) return fail(error.message);
  return ok({ id: data as string });
}

/** Validación en vivo del usuario o email al invitar a la app. */
export async function checkInviteClient(
  client: BrabusClient,
  clientId: string,
  mode: "email" | "username",
  value: string,
): Promise<InviteStatus | null> {
  const { data, error } = await client.rpc("validate_invite_client", {
    p_client_id: clientId,
    p_mode: mode,
    p_value: value,
  });
  if (error) return null;
  return data as InviteStatus;
}

/** Invita la ficha a usar la app (queda pendiente hasta que acepte). */
export async function inviteClient(
  client: BrabusClient,
  clientId: string,
  mode: "email" | "username",
  value: string,
): Promise<ActionResult<{ existed: boolean; email: string }>> {
  const { data, error } = await client.rpc("invite_client", {
    p_client_id: clientId,
    p_mode: mode,
    p_value: value,
  });
  if (error) return fail(error.message);
  return ok(data as { existed: boolean; email: string });
}

/**
 * Quita el acceso a la app (o cancela la invitación). Si la usaba, el alumno se
 * queda con una copia propia de sus rutinas; el coach conserva la ficha.
 */
export async function removeClientAccess(
  client: BrabusClient,
  clientId: string,
): Promise<ActionResult> {
  const { error } = await client.rpc("remove_client_access", { p_client_id: clientId });
  if (error) return fail(error.message);
  return ok(undefined);
}

/** Archiva (también quita el acceso a la app) o reactiva la ficha. */
export async function setClientArchived(
  client: BrabusClient,
  clientId: string,
  archived: boolean,
): Promise<ActionResult> {
  const { error } = await client.rpc("set_client_archived", {
    p_client_id: clientId,
    p_archived: archived,
  });
  if (error) return fail(error.message);
  return ok(undefined);
}

/** Borra la ficha y las rutinas que el coach le armó. */
export async function deleteClient(client: BrabusClient, clientId: string): Promise<ActionResult> {
  const { error } = await client.rpc("delete_client", { p_client_id: clientId });
  if (error) return fail(error.message);
  return ok(undefined);
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
  void studentId; // la RPC usa la sesión
  const { data } = await client.rpc("get_my_coaches", {});
  const links = data ?? [];
  if (links.length === 0) return [];

  const { data: profiles } = await client
    .from("profiles")
    .select("id, first_name, last_name, username")
    .in(
      "id",
      links.map((l) => l.coach_id),
    );
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return links.map((l) => {
    const p = byId.get(l.coach_id);
    return {
      linkId: l.link_id,
      coachId: l.coach_id,
      name: (p ? fullName(p.first_name, p.last_name) : "") || "Coach",
      username: p?.username ?? null,
      status: l.status,
      createdAt: l.created_at,
    };
  });
}

/** Aceptar o rechazar una invitación. */
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

/** El alumno se desvincula: se queda con una copia propia de sus rutinas. */
export async function leaveCoach(client: BrabusClient, linkId: string): Promise<ActionResult> {
  const { error } = await client.rpc("leave_coach", { p_link_id: linkId });
  if (error) return fail(error.message);
  return ok(undefined);
}
