import { Check, Trash2 } from "lucide-react";

import type { WorkoutRow } from "@brabus/shared";

import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Una serie: peso, reps, "hecha" (si hay descanso) y quitar. */
export function SetRow({
  index,
  row,
  withRest,
  canRemove,
  onChange,
  onToggleDone,
  onRemove,
}: {
  index: number;
  row: WorkoutRow;
  /** El ejercicio tiene descanso: se muestra el botón de serie hecha. */
  withRest: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<Pick<WorkoutRow, "weight" | "reps">>) => void;
  onToggleDone: () => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-14 shrink-0 text-xs">
        Serie {n}
      </span>
      <div className="relative flex-1">
        <DecimalInput
          placeholder="Peso"
          value={row.weight}
          onChange={(e) => onChange({ weight: e.target.value })}
          className={cn(row.weight.trim() !== "" && "pr-9")}
        />
        {row.weight.trim() !== "" && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
            Kg
          </span>
        )}
      </div>
      <Input
        type="number"
        inputMode="numeric"
        min="0"
        placeholder="Reps"
        value={row.reps}
        onChange={(e) => onChange({ reps: e.target.value })}
        className="flex-1"
      />
      {withRest ? (
        <Button
          variant={row.done ? "default" : "outline"}
          size="icon"
          aria-label={
            row.done
              ? `Serie ${n} hecha`
              : `Marcar serie ${n} como hecha y descansar`
          }
          aria-pressed={!!row.done}
          onClick={onToggleDone}
        >
          <Check className="size-4" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Quitar serie"
        onClick={onRemove}
        disabled={!canRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
