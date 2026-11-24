/**
 * Editor de rutinas (web y mobile): días y ejercicios tal como se editan en
 * pantalla, y cómo se arma lo que se guarda.
 *
 * Todo es puro: las apps lo usan con `useReducer` y ponen la UI, el orden
 * (arrastrar en la web, flechas en mobile) y el guardado.
 */

import { formatRest } from "./training";
import type { CatalogEntry } from "./catalog";
import type { RoutineDayInput } from "./database";
import type { RoutinePayload } from "./routine";

export type RoutineExerciseDraft = {
  key: string;
  id?: string;
  catalog: CatalogEntry | null;
  variant: string;
  sets_reps: string;
  /** Descanso entre series (segundos) o null = sin descanso. */
  rest: number | null;
};

export type RoutineDayDraft = {
  key: string;
  id?: string;
  name: string;
  exercises: RoutineExerciseDraft[];
};

/** Opción "crear carpeta nueva" del selector de carpeta. */
export const NEW_FOLDER = "__new__";
/** Destino "plantilla" (en vez de un cliente) al crear. */
export const ROUTINE_TEMPLATE = "__template__";
export const ROUTINE_TEMPLATE_LABEL = "Plantilla (en una carpeta)";

export const emptyRoutineExercise = (
  newKey: () => string,
): RoutineExerciseDraft => ({
  key: newKey(),
  catalog: null,
  variant: "",
  sets_reps: "",
  rest: null,
});

export const emptyRoutineDay = (newKey: () => string): RoutineDayDraft => ({
  key: newKey(),
  name: "",
  exercises: [emptyRoutineExercise(newKey)],
});

/** Rutina guardada → días para editar (las keys son los ids). */
export function routineDaysToDrafts(
  days: {
    id: string;
    name: string;
    exercises: {
      id: string;
      catalog: CatalogEntry;
      variant: string | null;
      sets_reps: string;
      rest_seconds: number | null;
    }[];
  }[],
): RoutineDayDraft[] {
  return days.map((d) => ({
    key: d.id,
    id: d.id,
    name: d.name,
    exercises: d.exercises.map((e) => ({
      key: e.id,
      id: e.id,
      catalog: e.catalog,
      variant: e.variant ?? "",
      sets_reps: e.sets_reps,
      rest: e.rest_seconds,
    })),
  }));
}

/** Mueve el elemento `index` una posición (-1 arriba, +1 abajo). */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export type RoutineDaysAction =
  | { type: "setDays"; days: RoutineDayDraft[] }
  | { type: "addDay"; day: RoutineDayDraft }
  | { type: "removeDay"; dayKey: string }
  | { type: "renameDay"; dayKey: string; name: string }
  | { type: "moveDay"; index: number; delta: -1 | 1 }
  | { type: "addExercise"; dayKey: string; exercise: RoutineExerciseDraft }
  | {
      type: "updateExercise";
      dayKey: string;
      exKey: string;
      patch: Partial<Omit<RoutineExerciseDraft, "key" | "id">>;
    }
  | { type: "removeExercise"; dayKey: string; exKey: string }
  | {
      type: "setExercises";
      dayKey: string;
      exercises: RoutineExerciseDraft[];
    }
  | { type: "moveExercise"; dayKey: string; index: number; delta: -1 | 1 };

const mapDay = (
  days: RoutineDayDraft[],
  dayKey: string,
  fn: (day: RoutineDayDraft) => RoutineDayDraft,
) => days.map((day) => (day.key === dayKey ? fn(day) : day));

export function routineDaysReducer(
  days: RoutineDayDraft[],
  action: RoutineDaysAction,
): RoutineDayDraft[] {
  switch (action.type) {
    case "setDays":
      return action.days;
    case "addDay":
      return [...days, action.day];
    case "removeDay":
      return days.filter((day) => day.key !== action.dayKey);
    case "renameDay":
      return mapDay(days, action.dayKey, (day) => ({
        ...day,
        name: action.name,
      }));
    case "moveDay":
      return moveItem(days, action.index, action.delta);
    case "addExercise":
      return mapDay(days, action.dayKey, (day) => ({
        ...day,
        exercises: [...day.exercises, action.exercise],
      }));
    case "updateExercise":
      return mapDay(days, action.dayKey, (day) => ({
        ...day,
        exercises: day.exercises.map((ex) =>
          ex.key === action.exKey ? { ...ex, ...action.patch } : ex,
        ),
      }));
    case "removeExercise":
      return mapDay(days, action.dayKey, (day) => ({
        ...day,
        exercises: day.exercises.filter((ex) => ex.key !== action.exKey),
      }));
    case "setExercises":
      return mapDay(days, action.dayKey, (day) => ({
        ...day,
        exercises: action.exercises,
      }));
    case "moveExercise":
      return mapDay(days, action.dayKey, (day) => ({
        ...day,
        exercises: moveItem(day.exercises, action.index, action.delta),
      }));
  }
}

/** "Sin descanso" o "Descanso 1:30 min". */
export const restLabel = (rest: number | null) =>
  rest === null ? "Sin descanso" : `Descanso ${formatRest(rest)}`;

/** Aclaración bajo "¿Para quién es?". */
export const routineTargetHint = (forClient: boolean) =>
  forClient
    ? "Es solo de este cliente: cambiarla no afecta a nadie más."
    : "Las plantillas no las ve nadie: sirven para armarles rutinas a tus clientes.";

/**
 * Carpeta donde se guarda (solo plantillas de coach): una existente, una nueva
 * con nombre, o un error si falta elegirla.
 */
export function resolveRoutineFolder({
  usesFolder,
  folderId,
  newFolderName,
}: {
  usesFolder: boolean;
  folderId: string | null;
  newFolderName: string;
}):
  | { ok: true; folderId: string | null; newFolderName: string | null }
  | { ok: false; error: string } {
  if (!usesFolder) return { ok: true, folderId: null, newFolderName: null };
  if (folderId === NEW_FOLDER) {
    if (!newFolderName.trim())
      return { ok: false, error: "Poné un nombre para la carpeta nueva." };
    return { ok: true, folderId: null, newFolderName: newFolderName.trim() };
  }
  if (folderId) return { ok: true, folderId, newFolderName: null };
  return {
    ok: false,
    error: "Elegí o creá una carpeta para guardar la rutina.",
  };
}

/** Días en pantalla → días a guardar (textos sin espacios de más). */
export function routineDaysPayload(days: RoutineDayDraft[]): RoutineDayInput[] {
  return days.map((day) => ({
    id: day.id,
    name: day.name.trim(),
    exercises: day.exercises.map((ex) => ({
      id: ex.id,
      catalog_id: ex.catalog?.id,
      variant: ex.variant.trim() || null,
      sets_reps: ex.sets_reps.trim(),
      rest_seconds: ex.rest,
    })),
  }));
}

/**
 * Lo que se manda al crear/editar, o el error de carpeta. El cliente solo va
 * al crear una rutina para un cliente.
 */
export function buildRoutinePayload(input: {
  name: string;
  days: RoutineDayDraft[];
  isEdit: boolean;
  forClient: boolean;
  /** Destino elegido al crear: ROUTINE_TEMPLATE o el id del cliente. */
  target: string;
  usesFolder: boolean;
  folderId: string | null;
  newFolderName: string;
}): { ok: true; payload: RoutinePayload } | { ok: false; error: string } {
  const folder = resolveRoutineFolder(input);
  if (!folder.ok) return folder;
  return {
    ok: true,
    payload: {
      name: input.name.trim(),
      folderId: folder.folderId,
      newFolderName: folder.newFolderName,
      clientId: !input.isEdit && input.forClient ? input.target : null,
      days: routineDaysPayload(input.days),
    },
  };
}

/** Destino inicial al crear: el alumno que vino elegido (si es cliente) o plantilla. */
export const initialRoutineTarget = (
  clientId: string | undefined,
  clients: { id: string }[],
) =>
  clientId && clients.some((c) => c.id === clientId)
    ? clientId
    : ROUTINE_TEMPLATE;

/** ¿Es la rutina de un cliente? Al editar lo dice la rutina; al crear, el destino. */
export const routineIsForClient = (
  isEdit: boolean,
  clientName: string | null | undefined,
  target: string,
) => (isEdit ? Boolean(clientName) : target !== ROUTINE_TEMPLATE);
