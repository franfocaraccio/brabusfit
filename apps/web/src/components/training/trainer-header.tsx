import { Play, Timer } from "lucide-react";

import { formatDuration } from "@brabus/shared";

import { Button } from "@/components/ui/button";

/** "← Volver", nombre del día, progreso y cronómetro (o "Empezar"). */
export function TrainerHeader({
  dayName,
  completedCount,
  total,
  startedAt,
  now,
  onBack,
  onStart,
}: {
  dayName: string;
  completedCount: number;
  total: number;
  startedAt: number | null;
  now: number;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Volver a la rutina
      </button>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{dayName}</h1>
          <p className="text-muted-foreground text-sm">
            {completedCount} de {total} ejercicios completados
          </p>
        </div>
        {startedAt === null ? (
          <Button size="sm" className="shrink-0 gap-1.5" onClick={onStart}>
            <Play className="size-4" /> Empezar
          </Button>
        ) : (
          <span
            className="bg-primary/15 text-primary-text inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums"
            aria-label="Tiempo de entrenamiento"
          >
            <Timer className="size-4" />
            {formatDuration(now - startedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
