import { Plus, Trash2 } from "lucide-react";
import type { Dispatch, ReactNode } from "react";

import {
  emptyRoutineExercise,
  type CatalogEntry,
  type RoutineDayDraft,
  type RoutineDaysAction,
} from "@brabus/shared";

import { SortableList } from "@/components/routines/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ExerciseRow } from "./exercise-row";

/** Un día de la rutina: nombre, ejercicios (reordenables) y "Agregar ejercicio". */
export function DayEditor({
  day,
  index,
  handle,
  canRemove,
  catalog,
  dispatch,
  newKey,
  onCatalogCreated,
}: {
  day: RoutineDayDraft;
  index: number;
  /** Manija para arrastrar el día. */
  handle: ReactNode;
  canRemove: boolean;
  catalog: CatalogEntry[];
  dispatch: Dispatch<RoutineDaysAction>;
  newKey: () => string;
  onCatalogCreated: (entry: CatalogEntry) => void;
}) {
  const dayKey = day.key;
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-end gap-2">
          <div className="mb-1.5">{handle}</div>
          <div className="flex-1 space-y-2">
            <Label htmlFor={`day-${dayKey}`}>Día {index + 1}</Label>
            <Input
              id={`day-${dayKey}`}
              value={day.name}
              onChange={(e) =>
                dispatch({ type: "renameDay", dayKey, name: e.target.value })
              }
              placeholder="Día 1 - Piernas"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Eliminar día"
            onClick={() => dispatch({ type: "removeDay", dayKey })}
            disabled={!canRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <SortableList
          items={day.exercises}
          onReorder={(exercises) =>
            dispatch({ type: "setExercises", dayKey, exercises })
          }
          className="space-y-3"
        >
          {(ex, _exIdx, exHandle) => (
            <ExerciseRow
              exercise={ex}
              handle={exHandle}
              catalog={catalog}
              canRemove={day.exercises.length > 1}
              onChange={(patch) =>
                dispatch({
                  type: "updateExercise",
                  dayKey,
                  exKey: ex.key,
                  patch,
                })
              }
              onCatalogCreated={onCatalogCreated}
              onRemove={() =>
                dispatch({ type: "removeExercise", dayKey, exKey: ex.key })
              }
            />
          )}
        </SortableList>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            dispatch({
              type: "addExercise",
              dayKey,
              exercise: emptyRoutineExercise(newKey),
            })
          }
        >
          <Plus className="size-4" /> Agregar ejercicio
        </Button>
      </CardContent>
    </Card>
  );
}
