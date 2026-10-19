import {
  fail,
  ok,
  validateRoutine,
  type ActionResult,
  type CatalogEntry,
  type Folder,
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

  const resolved = await resolveFolderId(client, payload);
  if ("error" in resolved) return fail(resolved.error);

  const { data, error } = await client.rpc("create_full_routine", {
    p_name: payload.name.trim(),
    p_folder_id: resolved.folderId,
    p_days: payload.days,
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

  const resolved = await resolveFolderId(client, payload);
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
export type SharedRoutineLite = {
  id: string;
  routineId: string;
  name: string;
  coachName: string | null;
};

type SharedRow = {
  id: string;
  routine: {
    id: string;
    name: string;
    owner: { first_name: string; last_name: string } | null;
  } | null;
};

/** Carpetas, rutinas propias y rutinas compartidas con el usuario. */
export async function getRoutinesOverview(
  client: BrabusClient,
  userId: string,
): Promise<{
  folders: FolderLite[];
  routines: RoutineLite[];
  shared: SharedRoutineLite[];
}> {
  const [foldersRes, routinesRes, sharedRes] = await Promise.all([
    client.from("folders").select("id, name").eq("owner_id", userId).order("name"),
    client
      .from("routines")
      .select("id, name, folder_id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("routine_shares")
      .select(
        "id, routine:routines(id, name, owner:profiles!routines_owner_id_fkey(first_name, last_name))",
      )
      .eq("shared_with_user_id", userId)
      .eq("status", "accepted"),
  ]);

  const sharedRows = (sharedRes.data ?? []) as unknown as SharedRow[];

  return {
    folders: (foldersRes.data ?? []) as FolderLite[],
    routines: (routinesRes.data ?? []) as RoutineLite[],
    shared: sharedRows
      .filter((s) => s.routine)
      .map((s) => ({
        id: s.id,
        routineId: s.routine!.id,
        name: s.routine!.name,
        coachName: s.routine!.owner
          ? `${s.routine!.owner.first_name} ${s.routine!.owner.last_name}`.trim()
          : null,
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
    .select("*")
    .eq("id", routineId)
    .maybeSingle();
  if (!routine || routine.owner_id !== userId) return null;

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

/** Rutina con sus días (y cantidad de ejercicios por día). Null si no existe o no hay acceso. */
export async function getRoutineDetail(
  client: BrabusClient,
  routineId: string,
): Promise<{ routine: Routine; days: RoutineDayLite[] } | null> {
  const { data: routine } = await client
    .from("routines")
    .select("*")
    .eq("id", routineId)
    .maybeSingle();
  if (!routine) return null;

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

  return { routine, days };
}
