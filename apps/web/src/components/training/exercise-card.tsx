import { Check, ChevronDown, Plus } from "lucide-react";
import { useState, type Dispatch } from "react";

import {
  formatRest,
  formatShortDate as formatDate,
  NOTE_MAX_LENGTH,
  summarizeHistory,
  type TrainingExercise,
  type WorkoutAction,
  type WorkoutRow,
} from "@brabus/shared";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ExerciseHistory } from "./exercise-history";
import { SetRow } from "./set-row";
import { VariantPicker } from "./variant-picker";

/**
 * Un ejercicio del día: círculo para completarlo rápido, encabezado que lo
 * expande y, abierto, historial, variante, series, detalle y "Guardar ejercicio".
 */
export function ExerciseCard({
  exercise: ex,
  isOpen,
  isDone,
  rows,
  variant,
  note,
  pending,
  dispatch,
  newKey,
  onToggleOpen,
  onQuickDone,
  onSetDone,
  onShowAllHistory,
  onSave,
}: {
  exercise: TrainingExercise;
  isOpen: boolean;
  /** undefined = nunca se tocó (sin aria-pressed, como antes). */
  isDone: boolean | undefined;
  rows: WorkoutRow[];
  variant: string | null;
  note: string;
  pending: boolean;
  dispatch: Dispatch<WorkoutAction>;
  newKey: () => string;
  onToggleOpen: () => void;
  onQuickDone: () => void;
  onSetDone: (row: WorkoutRow) => void;
  onShowAllHistory: () => void;
  onSave: () => void;
}) {
  // Se conserva al plegar y desplegar el ejercicio.
  const [historyOpen, setHistoryOpen] = useState(false);
  const exerciseId = ex.id;

  return (
    <Card
      className={cn(
        "overflow-hidden py-0 transition-opacity",
        isDone && !isOpen && "opacity-60",
      )}
    >
      <div className="flex items-center">
        {/* Círculo: completar / descompletar sin abrir el ejercicio */}
        <button
          type="button"
          onClick={onQuickDone}
          aria-pressed={isDone}
          aria-label={
            isDone
              ? `Desmarcar ${ex.name}`
              : `Marcar ${ex.name} como completado`
          }
          className="group/check flex size-12 shrink-0 cursor-pointer items-center justify-center self-stretch pl-2"
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border text-xs transition-all duration-200 group-active/check:scale-90",
              isDone
                ? "border-success bg-success text-success-foreground"
                : "text-muted-foreground group-hover/check:border-success/70",
            )}
          >
            {isDone ? (
              <Check className="size-4 animate-in zoom-in-50 duration-200" />
            ) : null}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleOpen}
          className="hover:bg-muted/40 active:bg-muted/60 flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-4 pl-1 text-left transition-colors"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {ex.name}
            </span>
            <span className="text-muted-foreground block text-xs">
              {ex.setsReps}
              {ex.restSeconds
                ? ` · Descanso ${formatRest(ex.restSeconds)}`
                : ""}
            </span>
            {ex.history[0] ? (
              <span className="text-foreground/70 mt-0.5 block text-xs">
                {summarizeHistory(ex.history[0])}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4 border-t px-4 py-4">
          {/* Historial: últimos entrenamientos */}
          {ex.history.length > 0 && (
            <ExerciseHistory
              history={ex.history}
              open={historyOpen}
              onToggle={() => setHistoryOpen((o) => !o)}
              onShowAll={onShowAllHistory}
            />
          )}

          {/* Variante con la que lo hizo */}
          <VariantPicker
            value={variant}
            onToggle={(v) =>
              dispatch({ type: "toggleVariant", exerciseId, variant: v })
            }
          />

          {/* Inputs de series */}
          <div className="space-y-2">
            {ex.history[0] ? (
              <p className="text-muted-foreground text-xs">
                Precargado con tu entrenamiento del{" "}
                {formatDate(ex.history[0].date)}. Si progresaste, editalo.
              </p>
            ) : null}
            {rows.map((row, i) => (
              <SetRow
                key={row.key}
                index={i}
                row={row}
                withRest={!!ex.restSeconds}
                canRemove={rows.length > 1}
                onChange={(patch) =>
                  dispatch({ type: "setRow", exerciseId, key: row.key, patch })
                }
                onToggleDone={() => onSetDone(row)}
                onRemove={() =>
                  dispatch({ type: "removeRow", exerciseId, key: row.key })
                }
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                dispatch({ type: "addRow", exerciseId, key: newKey() })
              }
            >
              <Plus className="size-4" /> Agregar serie
            </Button>
          </div>

          {/* Detalle / comentario opcional del ejercicio */}
          <div className="space-y-1.5">
            <label
              htmlFor={`note-${ex.id}`}
              className="text-muted-foreground text-xs font-medium"
            >
              Detalle (opcional)
            </label>
            {/* Una línea; crece sola si el texto no entra. */}
            <textarea
              id={`note-${ex.id}`}
              rows={1}
              maxLength={NOTE_MAX_LENGTH}
              value={note}
              onChange={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
                dispatch({ type: "setNote", exerciseId, note: e.target.value });
              }}
              placeholder="Ej: agarre cerrado"
              className="border-input bg-input/40 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 block w-full resize-none overflow-hidden rounded-xl border px-3.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3"
            />
          </div>

          <Button className="w-full" onClick={onSave} disabled={pending}>
            Guardar ejercicio
          </Button>
        </div>
      )}
    </Card>
  );
}
