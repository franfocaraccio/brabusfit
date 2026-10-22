"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createRoutine, updateRoutine } from "@/lib/actions/routines";
import type { CatalogEntry, RoutineDayInput } from "@brabus/shared";
import type { ClientSummary, FolderLite } from "@brabus/supabase";
import { ExercisePicker } from "@/components/routines/exercise-picker";
import { SortableList } from "@/components/routines/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExerciseDraft = {
  key: string;
  id?: string;
  catalog: CatalogEntry | null;
  variant: string;
  sets_reps: string;
};
type DayDraft = {
  key: string;
  id?: string;
  name: string;
  exercises: ExerciseDraft[];
};

const NEW_FOLDER = "__new__";
/** Destino "plantilla" (en vez de un cliente). */
const TEMPLATE = "__template__";
const newKey = () => crypto.randomUUID();

function emptyExercise(): ExerciseDraft {
  return { key: newKey(), catalog: null, variant: "", sets_reps: "" };
}
function emptyDay(): DayDraft {
  return { key: newKey(), name: "", exercises: [emptyExercise()] };
}

export type RoutineBuilderInitial = {
  id: string;
  name: string;
  folderId: string | null;
  /** Rutina de un cliente: no usa carpeta. */
  clientName: string | null;
  days: DayDraft[];
};

export function RoutineBuilder({
  folders,
  catalog,
  isCoach,
  initial,
  clients = [],
  initialClientId,
}: {
  folders: FolderLite[];
  /** Catálogo de ejercicios disponible (general + propios). */
  catalog: CatalogEntry[];
  isCoach: boolean;
  initial?: RoutineBuilderInitial;
  /** Coach, al crear: clientes a los que se le puede armar la rutina. */
  clients?: ClientSummary[];
  /** Alumno elegido de entrada (viene de su página). */
  initialClientId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  // null = ninguna carpeta elegida (muestra placeholder). Solo aplica a coaches.
  const [folderId, setFolderId] = useState<string | null>(
    initial?.folderId ?? null,
  );
  const [newFolderName, setNewFolderName] = useState("");
  // Coach al crear: plantilla (con carpeta) o rutina para un cliente.
  const [target, setTarget] = useState<string>(
    initialClientId && clients.some((c) => c.id === initialClientId)
      ? initialClientId
      : TEMPLATE,
  );
  const [days, setDays] = useState<DayDraft[]>(initial?.days ?? [emptyDay()]);
  // Catálogo local: suma los ejercicios propios que se crean en el momento.
  const [catalogList, setCatalogList] = useState<CatalogEntry[]>(catalog);

  const isEdit = Boolean(initial);
  const forClient = isEdit ? Boolean(initial?.clientName) : target !== TEMPLATE;
  const usesFolder = isCoach && !forClient;

  const targetItems: Record<string, string> = {
    [TEMPLATE]: "Plantilla (en una carpeta)",
    ...Object.fromEntries(clients.map((c) => [c.id, c.name])),
  };

  // Carpetas existentes + opción para crear una nueva en el momento.
  const folderItems: Record<string, string> = {
    ...Object.fromEntries(folders.map((f) => [f.id, f.name])),
    [NEW_FOLDER]: "➕ Crear carpeta nueva",
  };

  // --- mutadores de estado ---------------------------------------------------
  const updateDay = (key: string, patch: Partial<DayDraft>) =>
    setDays((d) =>
      d.map((day) => (day.key === key ? { ...day, ...patch } : day)),
    );

  const addDay = () => setDays((d) => [...d, emptyDay()]);
  const removeDay = (key: string) =>
    setDays((d) => d.filter((day) => day.key !== key));

  const addExercise = (dayKey: string) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? { ...day, exercises: [...day.exercises, emptyExercise()] }
          : day,
      ),
    );

  const updateExercise = (
    dayKey: string,
    exKey: string,
    patch: Partial<ExerciseDraft>,
  ) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              exercises: day.exercises.map((ex) =>
                ex.key === exKey ? { ...ex, ...patch } : ex,
              ),
            }
          : day,
      ),
    );

  const reorderExercises = (dayKey: string, exercises: ExerciseDraft[]) =>
    updateDay(dayKey, { exercises });

  const removeExercise = (dayKey: string, exKey: string) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              exercises: day.exercises.filter((ex) => ex.key !== exKey),
            }
          : day,
      ),
    );

  // --- guardar ---------------------------------------------------------------
  const handleSubmit = () => {
    // Resolución de carpeta según rol (validación inmediata para coaches).
    let folderIdPayload: string | null = null;
    let newFolderNamePayload: string | null = null;
    if (usesFolder) {
      if (folderId === NEW_FOLDER) {
        if (!newFolderName.trim()) {
          toast.error("Poné un nombre para la carpeta nueva.");
          return;
        }
        newFolderNamePayload = newFolderName.trim();
      } else if (folderId) {
        folderIdPayload = folderId;
      } else {
        toast.error("Elegí o creá una carpeta para guardar la rutina.");
        return;
      }
    }

    const payloadDays: RoutineDayInput[] = days.map((day) => ({
      id: day.id,
      name: day.name.trim(),
      exercises: day.exercises.map((ex) => ({
        id: ex.id,
        catalog_id: ex.catalog?.id,
        variant: ex.variant.trim() || null,
        sets_reps: ex.sets_reps.trim(),
      })),
    }));

    const payload = {
      name: name.trim(),
      folderId: folderIdPayload,
      newFolderName: newFolderNamePayload,
      clientId: !isEdit && forClient ? target : null,
      days: payloadDays,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateRoutine(initial!.id, payload)
        : await createRoutine(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Rutina actualizada" : "Rutina creada");
      router.push(`/rutinas/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="routine-name">Nombre de la rutina</Label>
          <Input
            id="routine-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Junio 2026 4 días"
          />
        </div>

        {isCoach && !isEdit && (
          <div className="space-y-2">
            <Label>¿Para quién es?</Label>
            <Select
              value={target}
              onValueChange={(v) => setTarget(v ?? TEMPLATE)}
              items={targetItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TEMPLATE}>
                  Plantilla (en una carpeta)
                </SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {forClient
                ? "Es solo de este cliente: cambiarla no afecta a nadie más."
                : "Las plantillas no las ve nadie: sirven para armarles rutinas a tus clientes."}
            </p>
          </div>
        )}

        {isCoach && isEdit && initial?.clientName && (
          <p className="text-muted-foreground text-sm">
            Rutina de:{" "}
            <span className="text-foreground font-medium">
              {initial.clientName}
            </span>
          </p>
        )}

        {usesFolder && (
          <div className="space-y-2">
            <Label>Carpeta</Label>
            <Select
              value={folderId}
              onValueChange={(v) => setFolderId(v)}
              items={folderItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí una carpeta" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_FOLDER}>
                  ➕ Crear carpeta nueva
                </SelectItem>
              </SelectContent>
            </Select>
            {folderId === NEW_FOLDER && (
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de la carpeta (ej: Fuerza)"
                autoFocus
              />
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <SortableList items={days} onReorder={setDays} className="space-y-4">
          {(day, dayIdx, dayHandle) => (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-end gap-2">
                  <div className="mb-1.5">{dayHandle}</div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`day-${day.key}`}>Día {dayIdx + 1}</Label>
                    <Input
                      id={`day-${day.key}`}
                      value={day.name}
                      onChange={(e) =>
                        updateDay(day.key, { name: e.target.value })
                      }
                      placeholder="Día 1 - Piernas"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar día"
                    onClick={() => removeDay(day.key)}
                    disabled={days.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <SortableList
                  items={day.exercises}
                  onReorder={(exercises) =>
                    reorderExercises(day.key, exercises)
                  }
                  className="space-y-3"
                >
                  {(ex, _exIdx, exHandle) => (
                    <div className="bg-muted/30 flex items-start gap-2 rounded-md border p-3">
                      <div className="mt-1.5 shrink-0">{exHandle}</div>
                      <div className="grid min-w-0 flex-1 gap-2">
                        <ExercisePicker
                          value={ex.catalog}
                          catalog={catalogList}
                          onChange={(entry) =>
                            updateExercise(day.key, ex.key, { catalog: entry })
                          }
                          onCreated={(entry) =>
                            setCatalogList((list) => [...list, entry])
                          }
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={ex.sets_reps}
                            onChange={(e) =>
                              updateExercise(day.key, ex.key, {
                                sets_reps: e.target.value,
                              })
                            }
                            placeholder="4 x (10 a 12)"
                            aria-label="Series y repeticiones"
                          />
                          <Input
                            value={ex.variant}
                            onChange={(e) =>
                              updateExercise(day.key, ex.key, {
                                variant: e.target.value,
                              })
                            }
                            placeholder="Variante (opcional)"
                            aria-label="Variante"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar ejercicio"
                        onClick={() => removeExercise(day.key, ex.key)}
                        disabled={day.exercises.length === 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </SortableList>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => addExercise(day.key)}
                >
                  <Plus className="size-4" /> Agregar ejercicio
                </Button>
              </CardContent>
            </Card>
          )}
        </SortableList>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={addDay}
        >
          <Plus className="size-4" /> Agregar día
        </Button>
      </div>

      <div className="bg-background/90 sticky bottom-16 z-20 -mx-4 border-t px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        <Button
          type="button"
          className="w-full"
          onClick={handleSubmit}
          disabled={pending}
        >
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear rutina"}
        </Button>
      </div>
    </div>
  );
}
