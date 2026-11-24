import { Timer } from "lucide-react";

import { formatDuration, type RestTimer } from "@brabus/shared";

import { Button } from "@/components/ui/button";

/** Barra fija de abajo: descanso en curso (si hay) y "Guardar sesión". */
export function SaveBar({
  rest,
  restLeft,
  completedCount,
  pending,
  onAdjustRest,
  onSkipRest,
  onSave,
}: {
  rest: RestTimer | null;
  restLeft: number;
  completedCount: number;
  pending: boolean;
  onAdjustRest: (deltaSeconds: number) => void;
  onSkipRest: () => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-background/90 sticky bottom-16 z-20 -mx-4 space-y-2 border-t px-4 py-3 backdrop-blur md:bottom-0 md:mx-0">
      {rest ? (
        <div
          className="bg-primary/15 flex items-center gap-3 rounded-xl px-3 py-2"
          role="timer"
          aria-live="polite"
        >
          <Timer className="text-primary-text size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground truncate text-xs">
              Descanso · {rest.exerciseName}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatDuration(restLeft * 1000)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onAdjustRest(-15)}>
            −15 s
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAdjustRest(15)}>
            +15 s
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkipRest}>
            Saltar
          </Button>
        </div>
      ) : null}
      <Button
        className="w-full"
        variant={completedCount > 0 ? "default" : "secondary"}
        onClick={onSave}
        disabled={pending || completedCount === 0}
      >
        Guardar sesión
      </Button>
    </div>
  );
}
