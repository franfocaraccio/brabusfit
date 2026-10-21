import {
  fail,
  ok,
  validateRoutine,
  type ActionResult,
  type CatalogEntry,
  type Folder,
  type LinkStatus,
  type Routine,
  type RoutinePayload,
} from "@brabus/shared";

import { getUserId, type BrabusClient } from "./client";

/**
 * Resuelve a qué carpeta va la rutina según el rol:
 * - Coach: obligatorio carpeta (existente o nueva). Crea la nueva si corresponde.
 * - Alumno: sin carpeta (todas sus rutinas van juntas) -> folderId null.
 */
async function resolveFolderId(
  client: BrabusClient,
  payload: RoutinePayload,
): Promise<{ folderId: string | null } | { error: string }> {
  const userId = await getUserId(client);
  if (!userId) return { error: "No autenticado." };

  const { data: profile } = await client
    .from("profiles")
    .select("is_coach")
    .eq("id", userId)
    .single();

  // Los alumnos no usan carpetas.
  if (!profile?.is_coach) return { folderId: null };

  const newName = payload.newFolderName?.trim();
  if (newName) {
    const { data: folder, error } = await client
      .from("folders")
      .insert({ owner_id: userId, name: newName })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { folderId: folder.id };
  }

  if (!payload.folderId) {
    return { error: "Elegí o creá una carpeta para guardar la rutina." };
  }
  return { folderId: payload.folderId };
}

export async function createRoutine(
  client: BrabusClient,
  payload: RoutinePayload,
): Promise<ActionResult<{ id: string }>> {
  const invalid = validateRoutine(payload);
  if (invalid) return fail(invalid);

  // Rutina para un alumno: no va en carpeta.
  const resolved = payload.studentLinkId
    ? { folderId: null }
    : await resolveFolderId(client, payload);
  if ("error" in resolved) return fail(resolved.error);

  const { data, error } = await client.rpc("create_full_routine", {
    p_name: payload.name.trim(),
    p_folder_id: resolved.folderId,
    p_days: payload.days,
    p_link_id: payload.studentLinkId ?? null,
  });
  if (error) return fail(error.message);
  return ok({ id: data as string });
}

export async function updateRoutine(
  client: BrabusClient,
  routineId: string,
  payload: RoutinePayload,
): Promise<ActionResult<{ id: string }>> {
  const invalid = validateRoutine(payload);
  if (invalid) return fail(invalid);

  const { data: current } = await client
    .from("routines")
    .select("student_email")
    .eq("id", routineId)
    .maybeSingle();
  const resolved = current?.student_email
    ? { folderId: null }
    : await resolveFolderId(client, payload);
  if ("error" in resolved) return fail(resolved.error);

  const { data, error } = await client.rpc("update_full_routine", {
    p_routine_id: routineId,
    p_name: payload.name.trim(),
    p_folder_id: resolved.folderId,
    p_days: payload.days,
  });
  if (error) return fail(error.message);
  return ok({ id: data as string });
}

/**
 * Copia independiente de una rutina propia: asignada a un alumno (linkId) o
 * como plantilla nueva. Editar una no afecta a la otra.
 */
export async function copyRoutine(
  client: BrabusClient,
  routineId: string,
  linkId: string | null,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await client.rpc("copy_routine", {
    p_routine_id: routineId,
    p_link_id: linkId,
  });
  if (error) return fail(error.message);
  return ok({ id: data as string });
}

export async function deleteRoutine(
  client: BrabusClient,
  routineId: string,
): Promise<ActionResult> {
  const { error } = await client.from("routines").delete().eq("id", routineId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function createFolder(
  client: BrabusClient,
  name: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("La carpeta necesita un nombre.");

  const userId = await getUserId(client);
  if (!userId) return fail("No autenticado.");

  const { error } = await client
    .from("folders")
    .insert({ owner_id: userId, name: trimmed });
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function deleteFolder(
  client: BrabusClient,
  folderId: string,
): Promise<ActionResult> {
  // Las rutinas dentro de la carpeta pasan a la raíz (folder_id = null por FK).
  const { error } = await client.from("folders").delete().eq("id", folderId);
  if (error) return fail(error.message);
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export type FolderLite = Pick<Folder, "id" | "name">;
export type RoutineLite = Pick<Routine, "id" | "name" | "folder_id">;

/** Alumno: rutina que le armó un coach. */
export type CoachRoutineLite = { id: string; name: string; coachName: string | null };

/** Coach: rutinas asignadas a un alumno (o a un ex alumno: le quedan guardadas). */
export type StudentRoutineGroup = {
  /** Email del alumno (identifica el grupo también si todavía no tiene cuenta). */
  key: string;
  name: string;
  studentId: string | null;
  /** null si ya no está vinculado (el alumno no las ve). */
  linkStatus: LinkStatus | null;
  routines: { id: string; name: string }[];
};

const fullName = (p: { first_name: string; last_name: string } | null) =>
  p ? `${p.first_name} ${p.last_name}`.trim() || null : null;

type OwnRow = {
  id: string;
  name: string;
  folder_id: string | null;
  student_id: string | null;
  student_email: string | null;
  student: { first_name: string; last_name: string } | null;
};

type FromCoachRow = {
  id: string;
  name: string;
  owner: { first_name: string; last_name: string } | null;
};

/**
 * Lo que muestra la sección Rutinas:
 * - folders / routines: plantillas del coach (o rutinas propias del alumno).
 * - students: rutinas que el coach asignó, agrupadas por alumno.
 * - fromCoaches: rutinas que los coaches le asignaron al alumno.
 */
export async function getRoutinesOverview(
  client: BrabusClient,
  userId: string,
): Promise<{
  folders: FolderLite[];
  routines: RoutineLite[];
  students: StudentRoutineGroup[];
  fromCoaches: CoachRoutineLite[];
}> {
  const [foldersRes, ownRes, linksRes, fromCoachesRes] = await Promise.all([
    client.from("folders").select("id, name").eq("owner_id", userId).order("name"),
    client
      .from("routines")
      .select(
        "id, name, folder_id, student_id, student_email, student:profiles!routines_student_id_fkey(first_name, last_name)",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("coach_students")
      .select(
        "student_email, status, student:profiles!coach_students_student_id_fkey(first_name, last_name)",
      )
      .eq("coach_id", userId),
    // RLS: solo las de coaches con vínculo activo.
    client
      .from("routines")
      .select("id, name, owner:profiles!routines_owner_id_fkey(first_name, last_name)")
      .eq("student_id", userId)
      .neq("owner_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const own = (ownRes.data ?? []) as unknown as OwnRow[];
  const links = new Map(
    (
      (linksRes.data ?? []) as unknown as {
        student_email: string;
        status: LinkStatus;
        student: { first_name: string; last_name: string } | null;
      }[]
    ).map((l) => [l.student_email.toLowerCase(), l]),
  );

  const groups = new Map<string, StudentRoutineGroup>();
  for (const r of own) {
    if (!r.student_email) continue;
    const key = r.student_email.toLowerCase();
    const link = links.get(key);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: fullName(r.student) ?? fullName(link?.student ?? null) ?? key,
        studentId: r.student_id,
        linkStatus: link?.status ?? null,
        routines: [],
      };
      groups.set(key, group);
    }
    group.routines.push({ id: r.id, name: r.name });
  }

  return {
    folders: (foldersRes.data ?? []) as FolderLite[],
    routines: own
      .filter((r) => !r.student_email)
      .map((r) => ({ id: r.id, name: r.name, folder_id: r.folder_id })),
    students: [...groups.values()].sort(
      (a, b) =>
        Number(a.linkStatus === null) - Number(b.linkStatus === null) ||
        a.name.localeCompare(b.name, "es"),
    ),
    fromCoaches: ((fromCoachesRes.data ?? []) as unknown as FromCoachRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      coachName: fullName(r.owner),
    })),
  };
}

/** Carpetas del usuario (para elegir dónde guardar una rutina). */
export async function getFolders(
  client: BrabusClient,
  userId: string,
): Promise<FolderLite[]> {
  const { data } = await client
    .from("folders")
    .select("id, name")
    .eq("owner_id", userId)
    .order("name");
  return (data ?? []) as FolderLite[];
}

export type EditableExercise = {
  id: string;
  catalog: CatalogEntry;
  variant: string | null;
  sets_reps: string;
};
export type EditableDay = { id: string; name: string; exercises: EditableExercise[] };
export type EditableRoutine = {
  id: string;
  name: string;
  folderId: string | null;
  /** Nombre del alumno si es una rutina asignada (no usa carpeta). */
  studentName: string | null;
  days: EditableDay[];
};

type EditDayRow = {
  id: string;
  name: string;
  position: number;
  exercises: {
    id: string;
    variant: string | null;
    sets_reps: string;
    position: number;
    catalog: CatalogEntry;
  }[];
};

/** Rutina completa para editar. Null si no existe o el usuario no es el dueño. */
export async function getRoutineForEdit(
  client: BrabusClient,
  routineId: string,
  userId: string,
): Promise<EditableRoutine | null> {
  const { data: routine } = await client
    .from("routines")
    .select("*, student:profiles!routines_student_id_fkey(first_name, last_name)")
    .eq("id", routineId)
    .maybeSingle();
  if (!routine || routine.owner_id !== userId) return null;
  const student = (routine as unknown as { student: { first_name: string; last_name: string } | null })
    .student;

  const { data: daysData } = await client
    .from("routine_days")
    .select(
      "id, name, position, exercises(id, variant, sets_reps, position, catalog:exercise_catalog(id, name, muscle_group, owner_id))",
    )
    .eq("routine_id", routineId)
    .order("position");

  return {
    id: routine.id,
    name: routine.name,
    folderId: routine.folder_id,
    studentName: routine.student_email ? (fullName(student) ?? routine.student_email) : null,
    days: ((daysData ?? []) as unknown as EditDayRow[]).map((d) => ({
      id: d.id,
      name: d.name,
      exercises: [...d.exercises]
        .sort((a, b) => a.position - b.position)
        .map((e) => ({
          id: e.id,
          catalog: e.catalog,
          variant: e.variant,
          sets_reps: e.sets_reps,
        })),
    })),
  };
}

export type RoutineDayLite = {
  id: string;
  name: string;
  position: number;
  exerciseCount: number;
};

type DayRow = {
  id: string;
  name: string;
  position: number;
  exercises: { count: number }[];
};

export type RoutineDetail = {
  routine: Routine;
  ownerName: string | null;
  /** Alumno asignado (rutina de alumno), o null si es plantilla / rutina propia. */
  student: { id: string | null; name: string; linkStatus: LinkStatus | null } | null;
  days: RoutineDayLite[];
};

/** Rutina con sus días (y cantidad de ejercicios por día). Null si no existe o no hay acceso. */
export async function getRoutineDetail(
  client: BrabusClient,
  routineId: string,
): Promise<RoutineDetail | null> {
  const { data: row } = await client
    .from("routines")
    .select(
      "*, owner:profiles!routines_owner_id_fkey(first_name, last_name), student:profiles!routines_student_id_fkey(first_name, last_name)",
    )
    .eq("id", routineId)
    .maybeSingle();
  if (!row) return null;
  const { owner, student: studentProfile, ...routine } = row as unknown as Routine & {
    owner: { first_name: string; last_name: string } | null;
    student: { first_name: string; last_name: string } | null;
  };

  let student: RoutineDetail["student"] = null;
  if (routine.student_email) {
    const { data: link } = await client
      .from("coach_students")
      .select("status")
      .eq("coach_id", routine.owner_id)
      .eq("student_email", routine.student_email)
      .maybeSingle();
    student = {
      id: routine.student_id,
      name: fullName(studentProfile) ?? routine.student_email,
      linkStatus: (link?.status as LinkStatus | undefined) ?? null,
    };
  }

  const { data: daysData } = await client
    .from("routine_days")
    .select("id, name, position, exercises(count)")
    .eq("routine_id", routineId)
    .order("position");

  const days = ((daysData ?? []) as unknown as DayRow[]).map((d) => ({
    id: d.id,
    name: d.name,
    position: d.position,
    exerciseCount: d.exercises[0]?.count ?? 0,
  }));

  return { routine, ownerName: fullName(owner), student, days };
}
