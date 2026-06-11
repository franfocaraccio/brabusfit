"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  History,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  finishSession,
  saveExerciseLog,
  startSession,
  type SetInput,
} from "@/lib/actions/training";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SavedSet = { set_number: number; weight: number | null; reps: number | null };
export type HistoryEntry = { date: string; sets: SavedSet[] };
export type ExerciseState = {
  id: string;
  name: string;
  setsReps: string;
  completed: boolean;
  savedSets: SavedSet[];
  history: HistoryEntry[];
};

type SetRow = { key: string; weight: string; reps: string };

const newKey = () => crypto.randomUUID();

function toRows(saved: SavedSet[]): SetRow[] {
  if (saved.length === 0) return [{ key: newKey(), weight: "", reps: "" }];
  return saved.map((s) => ({
    key: newKey(),
    weight: s.weight?.toString() ?? "",
    reps: s.reps?.toString() ?? "",
  }));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function summarizeSets(sets: SavedSet[]) {
  return sets
    .map((s) => {
      const w = s.weight !== null ? `${s.weight}kg` : "";
      const r = s.reps !== null ? `${s.reps}` : "";
      return [w, r].filter(Boolean).join(" × ");
    })
    .filter(Boolean)
    .join("  ·  ");
}

export function DayTrainer({
  routineId,
  dayId,
  dayName,
  initialSessionId,
  exercises,
}: {
  routineId: string;
  dayId: string;
  dayName: string;
  initialSessionId: string | null;
  exercises: ExerciseState[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const sessionRef = useRef<string | null>(initialSessionId);
  const [completed, setCompleted] = useState<Record<string, boolean>>(
    Object.fromEntries(exercises.map((e) => [e.id, e.completed])),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Record<string, SetRow[]>>(
    Object.fromEntries(exercises.map((e) => [e.id, toRows(e.savedSets)])),
  );
  const [showCloseWarning, setShowCloseWarning] = useState(false);

  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = exercises.length > 0 && completedCount === exercises.length;

  const ensureSession = async (): Promise<string | null> => {
    if (sessionRef.current) return sessionRef.current;
    const res = await startSession(routineId, dayId);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    sessionRef.current = res.data.sessionId;
    return res.data.sessionId;
  };

  const setRow = (exId: string, key: string, patch: Partial<SetRow>) =>
    setRows((prev) => ({
      ...prev,
      [exId]: prev[exId].map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));

  const addRow = (exId: string) =>
    setRows((prev) => ({
      ...prev,
      [exId]: [...prev[exId], { key: newKey(), weight: "", reps: "" }],
    }));

  const removeRow = (exId: string, key: string) =>
    setRows((prev) => ({
      ...prev,
      [exId]:
        prev[exId].length > 1
          ? prev[exId].filter((r) => r.key !== key)
          : prev[exId],
    }));

  const handleDone = (exId: string) => {
    startTransition(async () => {
      const sessionId = await ensureSession();
      if (!sessionId) return;

      const sets: SetInput[] = rows[exId].map((r, i) => ({
        set_number: i + 1,
        weight: r.weight.trim() === "" ? null : Number(r.weight),
        reps: r.reps.trim() === "" ? null : Number(r.reps),
      }));

      const res = await saveExerciseLog(sessionId, exId, sets);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCompleted((c) => ({ ...c, [exId]: true }));
      setOpenId(null);
      toast.success("Ejercicio guardado");
    });
  };

  const doClose = () => {
    startTransition(async () => {
      if (sessionRef.current) {
        const res = await finishSession(sessionRef.current);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
      }
      toast.success("Entrenamiento finalizado");
      router.push(`/rutinas/${routineId}`);
      router.refresh();
    });
  };

  const handleCloseClick = () => {
    if (allDone) {
      doClose();
    } else {
      setShowCloseWarning(true);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={() => router.push(`/rutinas/${routineId}`)}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Volver a la rutina
        </button>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{dayName}</h1>
        <p className="text-muted-foreground text-sm">
          {completedCount} de {exercises.length} ejercicios completados
        </p>
      </div>

      <div className="space-y-3">
        {exercises.map((ex) => {
          const isOpen = openId === ex.id;
          const isDone = completed[ex.id];
          return (
            <Card
              key={ex.id}
              className={cn(
                "overflow-hidden py-0 transition-opacity",
                isDone && !isOpen && "opacity-60",
              )}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : ex.id)}
                className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    isDone
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="size-4" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {ex.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {ex.setsReps}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "text-muted-foreground size-4 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {isOpen && (
                <div className="space-y-4 border-t px-4 py-4">
                  {/* Historial: últimos entrenamientos */}
                  {ex.history.length > 0 && (
                    <div>
                      <button
                        onClick={() =>
                          setHistoryOpen((h) => ({ ...h, [ex.id]: !h[ex.id] }))
                        }
                        className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
                      >
                        <History className="size-3.5" />
                        Últimos {ex.history.length} entrenamientos
                        <ChevronDown
                          className={cn(
                            "size-3.5 transition-transform",
                            historyOpen[ex.id] && "rotate-180",
                          )}
                        />
                      </button>
                      {historyOpen[ex.id] && (
                        <div className="mt-2 space-y-1.5">
                          {ex.history.map((h, i) => (
                            <div
                              key={i}
                              className="bg-muted/40 rounded-md px-3 py-2 text-xs"
                            >
                              <span className="text-muted-foreground mr-2 font-medium">
                                {formatDate(h.date)}
                              </span>
                              {summarizeSets(h.sets)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inputs de series */}
                  <div className="space-y-2">
                    {rows[ex.id].map((row, i) => (
                      <div key={row.key} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-14 shrink-0 text-xs">
                          Serie {i + 1}
                        </span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="0"
                          placeholder="Peso"
                          value={row.weight}
                          onChange={(e) =>
                            setRow(ex.id, row.key, { weight: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          placeholder="Reps"
                          value={row.reps}
                          onChange={(e) =>
                            setRow(ex.id, row.key, { reps: e.target.value })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Quitar serie"
                          onClick={() => removeRow(ex.id, row.key)}
                          disabled={rows[ex.id].length === 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => addRow(ex.id)}
                    >
                      <Plus className="size-4" /> Agregar serie
                    </Button>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handleDone(ex.id)}
                    disabled={pending}
                  >
                    Listo
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Cerrar rutina */}
      <div className="bg-background/90 sticky bottom-16 z-20 -mx-4 border-t px-4 py-3 backdrop-blur md:bottom-0 md:mx-0">
        <Button
          className="w-full"
          variant={allDone ? "default" : "secondary"}
          onClick={handleCloseClick}
          disabled={pending}
        >
          Listo — Cerrar rutina
        </Button>
      </div>

      <Dialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Todavía no terminaste</DialogTitle>
            <DialogDescription>
              Te quedan {exercises.length - completedCount} ejercicios sin
              completar. ¿Querés cerrar la rutina igualmente?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCloseWarning(false)}
              disabled={pending}
            >
              Seguir entrenando
            </Button>
            <Button onClick={doClose} disabled={pending}>
              Cerrar igualmente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
