"use client";

import { useRouter } from "next/navigation";
import { useId, useReducer, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createRoutine, updateRoutine } from "@/lib/actions/routines";
import {
  buildRoutinePayload,
  emptyRoutineDay,
  initialRoutineTarget,
  routineDaysReducer,
  routineIsForClient,
  routineTargetHint,
  type CatalogEntry,
  type RoutineDayDraft,
} from "@brabus/shared";
import type { ClientSummary, FolderLite } from "@brabus/supabase";
import { SortableList } from "@/components/routines/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { DayEditor } from "./day-editor";
import { FolderField, TargetField } from "./target-folder-fields";

const newKey = () => crypto.randomUUID();

export type RoutineBuilderInitial = {
  id: string;
  name: string;
  folderId: string | null;
  /** Rutina de un cliente: no usa carpeta. */
  clientName: string | null;
  days: RoutineDayDraft[];
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
  const [target, setTarget] = useState<string>(() =>
    initialRoutineTarget(initialClientId, clients),
  );
  // Las keys del primer día salen de useId: son iguales en el render del
  // servidor y en el del cliente (con randomUUID, el id/htmlFor del campo
  // "Día 1" no coincidía al hidratar).
  const baseId = useId();
  const [days, dispatch] = useReducer(
    routineDaysReducer,
    initial?.days,
    (d) => {
      let n = 0;
      return d ?? [emptyRoutineDay(() => `${baseId}-${n++}`)];
    },
  );
  // Catálogo local: suma los ejercicios propios que se crean en el momento.
  const [catalogList, setCatalogList] = useState<CatalogEntry[]>(catalog);

  const isEdit = Boolean(initial);
  const forClient = routineIsForClient(isEdit, initial?.clientName, target);
  const usesFolder = isCoach && !forClient;

  const handleSubmit = () => {
    const built = buildRoutinePayload({
      name,
      days,
      isEdit,
      forClient,
      target,
      usesFolder,
      folderId,
      newFolderName,
    });
    // Validación inmediata de la carpeta (coaches).
    if (!built.ok) {
      toast.error(built.error);
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateRoutine(initial!.id, built.payload)
        : await createRoutine(built.payload);

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
          <TargetField
            target={target}
            clients={clients}
            hint={routineTargetHint(forClient)}
            onChange={setTarget}
          />
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
          <FolderField
            folders={folders}
            folderId={folderId}
            newFolderName={newFolderName}
            newFolderPlaceholder="Nombre de la carpeta (ej: Fuerza)"
            onFolderChange={setFolderId}
            onNewFolderNameChange={setNewFolderName}
          />
        )}
      </div>

      <div className="space-y-4">
        <SortableList
          items={days}
          onReorder={(d) => dispatch({ type: "setDays", days: d })}
          className="space-y-4"
        >
          {(day, dayIdx, dayHandle) => (
            <DayEditor
              day={day}
              index={dayIdx}
              handle={dayHandle}
              canRemove={days.length > 1}
              catalog={catalogList}
              dispatch={dispatch}
              newKey={newKey}
              onCatalogCreated={(entry) =>
                setCatalogList((list) => [...list, entry])
              }
            />
          )}
        </SortableList>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() =>
            dispatch({ type: "addDay", day: emptyRoutineDay(newKey) })
          }
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
