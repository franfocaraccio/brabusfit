"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  History,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { saveWorkout, type SetInput } from "@/lib/actions/training";
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
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import { parseDecimal } from "@/lib/decimal";
import { cn } from "@/lib/utils";

type SavedSet = { set_number: number; weight: number | null; reps: number | null };
export type HistoryEntry = { date: string; sets: SavedSet[] };
export type ExerciseState = {
  id: string;
  name: string;
  setsReps: string;
  history: HistoryEntry[];
};

type SetRow = { key: string; weight: string; reps: string };

const newKey = () => crypto.randomUUID();
const emptyRow = (): SetRow => ({ key: newKey(), weight: "", reps: "" });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function summarizeSets(sets: SavedSet[]) {
  return sets
    .map((s) => {
      const w =
        s.weight !== null ? `${s.weight.toLocaleString("es-AR")}kg` : "";
      const r = s.reps !== null ? `${s.reps}` : "";
      return [w, r].filter(Boolean).join(" × ");
    })
    .filter(Boolean)
    .join("  ·  ");
}

const BACK = "__back__";

export function DayTrainer({
  routineId,
  dayId,
  dayName,
  exercises,
}: {
  routineId: string;
  dayId: string;
  dayName: string;
  exercises: ExerciseState[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Todo vive en memoria hasta "Cerrar rutina". Si el usuario se va sin
  // cerrar, la sesión se pierde y la próxima vez arranca de cero.
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Record<string, SetRow[]>>(
    Object.fromEntries(exercises.map((e) => [e.id, [emptyRow()]])),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  // Destino al que el usuario quiso ir con cambios sin guardar (o BACK).
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = exercises.length > 0 && completedCount === exercises.length;

  const dirty =
    completedCount > 0 ||
    Object.values(notes).some((n) => n.trim() !== "") ||
    Object.values(rows).some((rs) =>
      rs.some((r) => r.weight.trim() !== "" || r.reps.trim() !== ""),
    );

  // Cuando salimos a propósito (guardado o "salir sin guardar") no avisamos.
  const allowLeaveRef = useRef(false);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // 1) Cerrar pestaña / recargar: aviso nativo del navegador.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || allowLeaveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // 2) Clicks en links internos de la app (nav inferior, sidebar, etc.).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || allowLeaveRef.current) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTarget(url.pathname + url.search);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // 3) Botón "atrás" del navegador / celular: dejamos una entrada "centinela"
  //    en el historial apenas hay cambios, y si vuelven atrás la reponemos y
  //    preguntamos.
  const guardArmedRef = useRef(false);
  useEffect(() => {
    if (!dirty || guardArmedRef.current) return;
    guardArmedRef.current = true;
    window.history.pushState({ brabusGuard: true }, "");
  }, [dirty]);

  useEffect(() => {
    const onPopState = () => {
      if (!guardArmedRef.current || allowLeaveRef.current) return;
      if (!dirtyRef.current) {
        // Sin cambios: dejamos seguir el "atrás" normalmente.
        guardArmedRef.current = false;
        window.history.back();
        return;
      }
      window.history.pushState({ brabusGuard: true }, "");
      setLeaveTarget(BACK);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const leave = (target: string) => {
    allowLeaveRef.current = true;
    if (target === BACK) {
      // Salteamos la entrada centinela y volvemos a la página anterior real.
      window.history.go(-2);
    } else {
      router.push(target);
    }
  };

  const navigate = (target: string) => {
    if (dirty) setLeaveTarget(target);
    else leave(target);
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

  // Marca el ejercicio como hecho (solo en memoria; se guarda al cerrar).
  const handleDone = (exId: string) => {
    setCompleted((c) => ({ ...c, [exId]: true }));
    setOpenId(null);
  };

  const doClose = () => {
    const logs = exercises
      .filter((ex) => completed[ex.id])
      .map((ex) => ({
        exerciseId: ex.id,
        note: notes[ex.id] ?? null,
        sets: rows[ex.id].map(
          (r, i): SetInput => ({
            set_number: i + 1,
            weight: parseDecimal(r.weight),
            reps: r.reps.trim() === "" ? null : Number(r.reps),
          }),
        ),
      }));

    startTransition(async () => {
      const res = await saveWorkout(routineId, dayId, logs);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setShowCloseWarning(false);
      toast.success(
        logs.length > 0 ? "Entrenamiento guardado" : "Rutina cerrada sin cambios",
      );
      leave(`/rutinas/${routineId}`);
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
          onClick={() => navigate(`/rutinas/${routineId}`)}
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
                className="hover:bg-muted/40 active:bg-muted/60 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs transition-all duration-200",
                    isDone
                      ? "border-success bg-success text-success-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <Check className="size-4 animate-in zoom-in-50 duration-200" />
                  ) : null}
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
                        <div className="relative flex-1">
                          <DecimalInput
                            placeholder="Peso"
                            value={row.weight}
                            onChange={(e) =>
                              setRow(ex.id, row.key, { weight: e.target.value })
                            }
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
                          onChange={(e) =>
                            setRow(ex.id, row.key, { reps: e.target.value })
                          }
                          className="flex-1"
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

                  {/* Detalle / comentario opcional del ejercicio */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor={`note-${ex.id}`}
                      className="text-muted-foreground text-xs font-medium"
                    >
                      Detalle (opcional)
                    </label>
                    <textarea
                      id={`note-${ex.id}`}
                      rows={2}
                      value={notes[ex.id] ?? ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [ex.id]: e.target.value }))
                      }
                      placeholder="Ej: me costó la última serie, subir peso la próxima"
                      className="border-input bg-input/40 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 w-full resize-y rounded-xl border px-3.5 py-2 text-sm outline-none transition-colors focus-visible:ring-3"
                    />
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
              {completedCount === 0
                ? "No marcaste ningún ejercicio como completado, así que no se va a guardar nada. ¿Querés cerrar la rutina igualmente?"
                : `Te quedan ${exercises.length - completedCount} ejercicios sin completar. Se guardan solo los ${completedCount} que marcaste como listos. ¿Querés cerrar la rutina igualmente?`}
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
              {pending ? "Guardando…" : "Cerrar igualmente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aviso al salir con cambios sin guardar */}
      <Dialog
        open={leaveTarget !== null}
        onOpenChange={(o) => {
          if (!o) setLeaveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Los cambios no fueron guardados</DialogTitle>
            <DialogDescription>
              Si salís ahora se pierde lo que cargaste en este entrenamiento.
              Para guardarlo, usá &quot;Listo — Cerrar rutina&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeaveTarget(null)}>
              Seguir entrenando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const target = leaveTarget;
                setLeaveTarget(null);
                if (target) leave(target);
              }}
            >
              Salir sin guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
