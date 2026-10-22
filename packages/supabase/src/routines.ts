import {
  fail,
  ok,
  validateRoutine,
  type ActionResult,
  type CatalogEntry,
  type Folder,
  clientStatus,
  type AppAccess,
  type ClientStatus,
  type Routine,
  type RoutineExport,
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

  // Rutina de un cliente: no va en carpeta.
  const resolved = payload.clientId
    ? { folderId: null }
    : await resolveFolderId(client, payload);
  if ("error" in resolved) return fail(resolved.error);

  const { data, error } = await client.rpc("create_full_routine", {
    p_name: payload.name.trim(),
    p_folder_id: resolved.folderId,
    p_days: payload.days,
    p_link_id: payload.clientId ?? null,
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
    .select("client_id")
    .eq("id", routineId)
    .maybeSingle();
  const resolved = current?.client_id
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

/** Coach: rutinas que le armó a un cliente. */
export type ClientRoutineGroup = {
  clientId: string;
  name: string;
  appAccess: AppAccess;
  archived: boolean;
  routines: { id: string; name: string }[];
};

export type Person = { first_name: string; last_name: string };
export const fullName = (p: Person | null) => (p ? `${p.first_name} ${p.last_name}`.trim() || null : null);

export type ClientNameRow = {
  id: string;
  first_name: string;
  last_name: string;
  student_email: string | null;
  status: AppAccess;
  student_id: string | null;
  archived_at: string | null;
  account: Person | null;
};
export const CLIENT_NAME_SELECT =
  "id, first_name, last_name, student_email, status, student_id, archived_at, account:profiles!coach_students_student_id_fkey(first_name, last_name)";
/** Cliente de una rutina o plan (solo lo ve su coach). */
export type ClientRef = {
  id: string;
  name: string;
  appAccess: AppAccess;
  status: ClientStatus;
  archived: boolean;
};
export const clientRef = (c: ClientNameRow): ClientRef => ({
  id: c.id,
  name: clientName(c),
  appAccess: c.status,
  status: clientStatus(c.status, c.student_id !== null),
  archived: c.archived_at !== null,
});

export const clientName = (c: ClientNameRow) =>
  fullName(c) ?? fullName(c.account) ?? c.student_email ?? "Cliente";

type FromCoachRow = { id: string; name: string; owner: Person | null };

/**
 * Lo que muestra la sección Rutinas:
 * - folders / routines: plantillas del coach (o rutinas propias del alumno).
 * - clients: rutinas que el coach les armó a sus clientes, agrupadas por ficha.
 * - fromCoaches: rutinas que los coaches le armaron al alumno.
 */
export async function getRoutinesOverview(
  client: BrabusClient,
  userId: string,
): Promise<{
  folders: FolderLite[];
  routines: RoutineLite[];
  clients: ClientRoutineGroup[];
  fromCoaches: CoachRoutineLite[];
}> {
  const [foldersRes, ownRes, clientsRes, fromCoachesRes] = await Promise.all([
    client.from("folders").select("id, name").eq("owner_id", userId).order("name"),
    client
      .from("routines")
      .select("id, name, folder_id, client_id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    client.from("coach_students").select(CLIENT_NAME_SELECT).eq("coach_id", userId),
    // RLS: solo las de coaches con acceso activo.
    client
      .from("routines")
      .select("id, name, owner:profiles!routines_owner_id_fkey(first_name, last_name)")
      .neq("owner_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const own = ownRes.data ?? [];
  const clients = new Map(
    ((clientsRes.data ?? []) as unknown as ClientNameRow[]).map((c) => [c.id, c]),
  );

  const groups = new Map<string, ClientRoutineGroup>();
  for (const r of own) {
    const c = r.client_id ? clients.get(r.client_id) : undefined;
    if (!c) continue;
    let group = groups.get(c.id);
    if (!group) {
      group = {
        clientId: c.id,
        name: clientName(c),
        appAccess: c.status,
        archived: c.archived_at !== null,
        routines: [],
      };
      groups.set(c.id, group);
    }
    group.routines.push({ id: r.id, name: r.name });
  }

  return {
    folders: (foldersRes.data ?? []) as FolderLite[],
    routines: own
      .filter((r) => !r.client_id)
      .map((r) => ({ id: r.id, name: r.name, folder_id: r.folder_id })),
    clients: [...groups.values()].sort(
      (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, "es"),
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
  /** Nombre del cliente si es una rutina de cliente (no usa carpeta). */
  clientName: string | null;
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

/** Nombre del cliente de una rutina (solo lo puede leer su coach). */
export async function getClientOf(
  client: BrabusClient,
  clientId: string | null,
): Promise<ClientNameRow | null> {
  if (!clientId) return null;
  const { data } = await client
    .from("coach_students")
    .select(CLIENT_NAME_SELECT)
    .eq("id", clientId)
    .maybeSingle();
  return (data as unknown as ClientNameRow | null) ?? null;
}

/** Rutina completa para editar. Null si no existe o el usuario no es el dueño. */
export async function getRoutineForEdit(
  client: BrabusClient,
  routineId: string,
  userId: string,
): Promise<EditableRoutine | null> {
  const { data: routine } = await client
    .from("routines")
    .select("*")
    .eq("id", routineId)
    .maybeSingle();
  if (!routine || routine.owner_id !== userId) return null;

  const [owner, { data: daysData }] = await Promise.all([
    getClientOf(client, routine.client_id),
    client
      .from("routine_days")
      .select(
        "id, name, position, exercises(id, variant, sets_reps, position, catalog:exercise_catalog(id, name, muscle_group, owner_id))",
      )
      .eq("routine_id", routineId)
      .order("position"),
  ]);

  return {
    id: routine.id,
    name: routine.name,
    folderId: routine.folder_id,
    clientName: routine.client_id ? (owner ? clientName(owner) : "Cliente") : null,
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
  /** Cliente de la rutina (solo para su coach), o null si es plantilla / rutina propia. */
  client: ClientRef | null;
  days: RoutineDayLite[];
};

/** Rutina con sus días (y cantidad de ejercicios por día). Null si no existe o no hay acceso. */
export async function getRoutineDetail(
  client: BrabusClient,
  routineId: string,
): Promise<RoutineDetail | null> {
  const { data: row } = await client
    .from("routines")
    .select("*, owner:profiles!routines_owner_id_fkey(first_name, last_name)")
    .eq("id", routineId)
    .maybeSingle();
  if (!row) return null;
  const { owner, ...routine } = row as unknown as Routine & { owner: Person | null };

  const [c, { data: daysData }] = await Promise.all([
    getClientOf(client, routine.client_id),
    client
      .from("routine_days")
      .select("id, name, position, exercises(count)")
      .eq("routine_id", routineId)
      .order("position"),
  ]);

  const days = ((daysData ?? []) as unknown as DayRow[]).map((d) => ({
    id: d.id,
    name: d.name,
    position: d.position,
    exerciseCount: d.exercises[0]?.count ?? 0,
  }));

  return {
    routine,
    ownerName: fullName(owner),
    client: c ? clientRef(c) : null,
    days,
  };
}

type ExportDayRow = {
  name: string;
  position: number;
  exercises: { name: string; sets_reps: string; position: number }[];
};

/** Rutina para exportar a PDF / Excel (solo ejercicios). Null si no hay acceso. */
export async function getRoutineExport(
  client: BrabusClient,
  routineId: string,
  /** Si ya se cargó el detalle, se reusa. */
  loaded?: RoutineDetail,
): Promise<RoutineExport | null> {
  const detail = loaded ?? (await getRoutineDetail(client, routineId));
  if (!detail) return null;
  const { data: daysData } = await client
    .from("routine_days")
    .select("name, position, exercises(name, sets_reps, position)")
    .eq("routine_id", routineId)
    .order("position");

  return {
    name: detail.routine.name,
    clientName: detail.client?.name ?? null,
    coachName: detail.ownerName,
    date: new Date().toISOString(),
    days: ((daysData ?? []) as unknown as ExportDayRow[]).map((d) => ({
      name: d.name,
      exercises: [...d.exercises]
        .sort((a, b) => a.position - b.position)
        .map((e) => ({ name: e.name, setsReps: e.sets_reps })),
    })),
  };
}
