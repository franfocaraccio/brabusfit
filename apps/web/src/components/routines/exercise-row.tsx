import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import {
  REST_OPTIONS,
  restLabel,
  type CatalogEntry,
  type RoutineExerciseDraft,
} from "@brabus/shared";

import { ExercisePicker } from "@/components/routines/exercise-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Opción "sin descanso" del selector. */
const NO_REST = "none";
const restItems: Record<string, string> = {
  [NO_REST]: restLabel(null),
  ...Object.fromEntries(REST_OPTIONS.map((s) => [String(s), restLabel(s)])),
};

/** Un ejercicio del día: catálogo, series/reps, variante, descanso y quitar. */
export function ExerciseRow({
  exercise: ex,
  handle,
  catalog,
  canRemove,
  onChange,
  onCatalogCreated,
  onRemove,
}: {
  exercise: RoutineExerciseDraft;
  /** Manija para arrastrar. */
  handle: ReactNode;
  catalog: CatalogEntry[];
  canRemove: boolean;
  onChange: (patch: Partial<Omit<RoutineExerciseDraft, "key" | "id">>) => void;
  onCatalogCreated: (entry: CatalogEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-muted/30 flex items-start gap-2 rounded-md border p-3">
      <div className="mt-1.5 shrink-0">{handle}</div>
      <div className="grid min-w-0 flex-1 gap-2">
        <ExercisePicker
          value={ex.catalog}
          catalog={catalog}
          onChange={(entry) => onChange({ catalog: entry })}
          onCreated={onCatalogCreated}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Input
            value={ex.sets_reps}
            onChange={(e) => onChange({ sets_reps: e.target.value })}
            placeholder="4 x (10 a 12)"
            aria-label="Series y repeticiones"
          />
          <Input
            value={ex.variant}
            onChange={(e) => onChange({ variant: e.target.value })}
            placeholder="Variante (opcional)"
            aria-label="Variante"
          />
          <Select
            value={ex.rest === null ? NO_REST : String(ex.rest)}
            onValueChange={(v) =>
              onChange({ rest: !v || v === NO_REST ? null : Number(v) })
            }
            items={restItems}
          >
            <SelectTrigger
              className="col-span-2 w-full sm:col-span-1"
              aria-label="Descanso entre series"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(restItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Eliminar ejercicio"
        onClick={onRemove}
        disabled={!canRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
