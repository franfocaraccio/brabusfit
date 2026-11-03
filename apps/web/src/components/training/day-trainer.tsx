"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  History,
  Play,
  Plus,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import {
  EXERCISE_VARIANTS,
  formatDuration,
  formatRest,
  formatShortDate as formatDate,
  formatVolume,
  formatWeight,
  hasIncompleteRows,
  HISTORY_PREVIEW,
  historyLabel,
  NOTE_MAX_LENGTH,
  parseDecimal,
  parseSetRows,
  summarizeHistory,
  volumeProgress,
  clearDraft,
  describeDraft,
  draftKey,
  loadDraft,
  loadTimerStart,
  saveDraft,
  saveTimerStart,
  timerKey,
  type HistoryEntry,
  type SetInput,
  type VolumeProgress,
  type WorkoutDraft,
  type TrainingExercise,
} from "@brabus/shared";

import { saveWorkout } from "@/lib/actions/training";
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
import { cn } from "@/lib/utils";

export type ExerciseState = TrainingExercise;

type SetRow = { key: string; weight: string; reps: string; done?: boolean };

const newKey = () => crypto.randomUUID();
const emptyRow = (): SetRow => ({ key: newKey(), weight: "", reps: "" });

/** Series iniciales: las del último entrenamiento, o una fila vacía. */
function initialRowsFor(ex: ExerciseState): SetRow[] {
  const last = ex.history[0];
  if (!last || last.sets.length === 0) return [emptyRow()];
  return last.sets.map((s) => ({
    key: newKey(),
    weight: s.weight !== null ? formatWeight(s.weight) : "",
    reps: s.reps !== null ? String(s.reps) : "",
  }));
}

/** Firma comparable de las series (para saber si el usuario cambió algo). */
const rowsSignature = (rs: SetRow[]) =>
  rs.map((r) => `${r.weight.trim()}|${r.reps.trim()}`).join(";");

const BACK = "__back__";

/** Tiempo desde "Empezar" (null si no se usó el cronómetro). */
const elapsedSince = (start: number | null) =>
  start === null ? null : Date.now() - start;

/** Cuenta regresiva de descanso en curso. */
type Rest = { exerciseName: string; endsAt: number };

/** Confirmación pendiente por series incompletas. */
type IncompleteCheck = { kind: "exercise"; exId: string } | { kind: "session" };

export function DayTrainer({
  userId,
  routineId,
  dayId,
  dayName,
  exercises,
}: {
  userId: string;
  routineId: string;
  dayId: string;
  dayName: string;
  exercises: ExerciseState[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Todo vive en memoria hasta "Guardar sesión" (con un respaldo local que se
  // ofrece recuperar si la pestaña se cerró de golpe). Cada sesión nueva
  // arranca precargada con las series del último entrenamiento.
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  // Ejercicio cuyo historial completo se muestra en el popup "Ver más".
  const [historyDialog, setHistoryDialog] = useState<ExerciseState | null>(
    null,
  );
  const [rows, setRows] = useState<Record<string, SetRow[]>>(() =>
    Object.fromEntries(exercises.map((e) => [e.id, initialRowsFor(e)])),
  );
  // Foto de lo precargado, para detectar cambios reales del usuario.
  const [initialSignatures] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(rows).map(([id, rs]) => [id, rowsSignature(rs)]),
    ),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Variante anotada: arranca con la de la última vez.
  const [variants, setVariants] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      exercises.map((e) => [e.id, e.history[0]?.variant ?? null]),
    ),
  );
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  // Destino al que el usuario quiso ir con cambios sin guardar (o BACK).
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  // Cronómetro del entrenamiento (desde "Empezar") y descanso entre series.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<Rest | null>(null);
  // Pop-ups: series incompletas, progresión y rutina completada.
  const [incomplete, setIncomplete] = useState<IncompleteCheck | null>(null);
  const [progress, setProgress] = useState<{
    name: string;
    data: VolumeProgress;
  } | null>(null);
  const [finished, setFinished] = useState<{ elapsed: number | null } | null>(
    null,
  );
  // "¡Rutina completada!" queda esperando a que se cierre el pop-up de progresión.
  const pendingFinishRef = useRef(false);

  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = exercises.length > 0 && completedCount === exercises.length;

  const dirty =
    completedCount > 0 ||
    Object.values(notes).some((n) => n.trim() !== "") ||
    Object.entries(rows).some(
      ([id, rs]) => rowsSignature(rs) !== initialSignatures[id],
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

  // --- Respaldo local por si se cierra la pestaña/app de golpe -------------
  const draftId = draftKey(userId, dayId);
  const timerId = timerKey(userId, dayId);
  const storage = () =>
    typeof window === "undefined" ? undefined : window.localStorage;
  const [pendingDraft, setPendingDraft] = useState<WorkoutDraft | null>(null);

  // Al entrar: si quedó una sesión sin guardar (menos de 24 h), preguntamos. El
  // cronómetro, si ya se había empezado, sigue contando.
  useEffect(() => {
    const draft = loadDraft(storage(), draftId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
    if (draft) setPendingDraft(draft);
    const start = loadTimerStart(storage(), timerId);
    if (start) setStartedAt(start);
  }, [draftId, timerId]);

  // Un tic por segundo mientras corre el cronómetro o un descanso.
  useEffect(() => {
    if (startedAt === null && rest === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, rest]);

  // Fin del descanso: aviso y se cierra la cuenta regresiva.
  useEffect(() => {
    if (rest && now >= rest.endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el descanso vence con el reloj
      setRest(null);
      toast.success("¡Descanso terminado! A la próxima serie.");
    }
  }, [now, rest]);

  const startWorkout = () => {
    const start = Date.now();
    setStartedAt(start);
    setNow(start);
    saveTimerStart(storage(), timerId, start);
  };

  /** Guarda el borrador con el estado actual (se llama al guardar/marcar un ejercicio). */
  const persistDraft = (nextCompleted: Record<string, boolean>) =>
    saveDraft(storage(), draftId, {
      routineId,
      dayId,
      completed: Object.keys(nextCompleted).filter((id) => nextCompleted[id]),
      rows: Object.fromEntries(
        Object.entries(rows).map(([id, rs]) => [
          id,
          rs.map((r) => ({ weight: r.weight, reps: r.reps })),
        ]),
      ),
      notes,
      variants,
    });

  const restoreDraft = (draft: WorkoutDraft) => {
    const ids = new Set(exercises.map((e) => e.id));
    setCompleted(
      Object.fromEntries(
        draft.completed.filter((id) => ids.has(id)).map((id) => [id, true]),
      ),
    );
    setRows((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(draft.rows)
          .filter(([id, rs]) => ids.has(id) && rs.length > 0)
          .map(([id, rs]) => [id, rs.map((r) => ({ key: newKey(), ...r }))]),
      ),
    }));
    setNotes(
      Object.fromEntries(
        Object.entries(draft.notes).filter(([id]) => ids.has(id)),
      ),
    );
    if (draft.variants) {
      setVariants((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(draft.variants ?? {}).filter(([id]) => ids.has(id)),
        ),
      }));
    }
    setPendingDraft(null);
  };

  const discardDraft = () => {
    clearDraft(storage(), draftId);
    clearDraft(storage(), timerId);
    setStartedAt(null);
    setPendingDraft(null);
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

  // Serie hecha: la marca y arranca el descanso que fijó el coach.
  const toggleSetDone = (ex: ExerciseState, row: SetRow) => {
    const done = !row.done;
    setRow(ex.id, row.key, { done });
    if (done && ex.restSeconds) {
      const start = Date.now();
      setNow(start);
      setRest({ exerciseName: ex.name, endsAt: start + ex.restSeconds * 1000 });
    }
  };

  const adjustRest = (deltaSeconds: number) =>
    setRest((r) => {
      if (!r) return r;
      const endsAt = r.endsAt + deltaSeconds * 1000;
      return endsAt <= Date.now() ? null : { ...r, endsAt };
    });

  /** Marca el ejercicio como hecho y encadena progresión / rutina completada. */
  const completeExercise = (ex: ExerciseState) => {
    const next = { ...completed, [ex.id]: true };
    setCompleted(next);
    persistDraft(next);
    setOpenId(null);

    const nowAllDone = exercises.every((e) => next[e.id]);
    const gain = volumeProgress(parseSetRows(rows[ex.id]), ex.history[0]);
    if (gain) {
      pendingFinishRef.current = nowAllDone;
      setProgress({ name: ex.name, data: gain });
    } else if (nowAllDone) {
      setFinished({ elapsed: elapsedSince(startedAt) });
    }
  };

  // "Guardar ejercicio": si hay series a medio cargar, primero se confirma.
  const handleDone = (ex: ExerciseState) => {
    if (hasIncompleteRows(rows[ex.id])) {
      setIncomplete({ kind: "exercise", exId: ex.id });
      return;
    }
    completeExercise(ex);
  };

  // Tocar el círculo: completa (o descompleta) sin abrir el ejercicio. Se
  // guardan las series tal como estén (precargadas o editadas).
  const toggleQuickDone = (ex: ExerciseState) => {
    if (completed[ex.id]) {
      const next = { ...completed, [ex.id]: false };
      setCompleted(next);
      persistDraft(next);
      return;
    }
    handleDone(ex);
  };

  const closeProgress = () => {
    setProgress(null);
    if (pendingFinishRef.current) {
      pendingFinishRef.current = false;
      setFinished({ elapsed: elapsedSince(startedAt) });
    }
  };

  const doClose = () => {
    const logs = exercises
      .filter((ex) => completed[ex.id])
      .map((ex) => ({
        exerciseId: ex.id,
        note: notes[ex.id] ?? null,
        variant: variants[ex.id] ?? null,
        sets: rows[ex.id].map((r, i): SetInput => ({
          set_number: i + 1,
          weight: parseDecimal(r.weight),
          reps: r.reps.trim() === "" ? null : Number(r.reps),
        })),
      }));

    startTransition(async () => {
      const res = await saveWorkout(
        routineId,
        dayId,
        logs,
        startedAt === null ? null : new Date(startedAt).toISOString(),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      clearDraft(storage(), draftId);
      clearDraft(storage(), timerId);
      setShowCloseWarning(false);
      setFinished(null);
      toast.success("Sesión guardada");
      leave(`/rutinas/${routineId}`);
      router.refresh();
    });
  };

  // "Guardar sesión": series incompletas → ejercicios sin terminar → guardar.
  const checkUnfinished = () => {
    if (allDone) doClose();
    else setShowCloseWarning(true);
  };

  const handleCloseClick = () => {
    const anyIncomplete = exercises.some(
      (ex) => completed[ex.id] && hasIncompleteRows(rows[ex.id]),
    );
    if (anyIncomplete) {
      setIncomplete({ kind: "session" });
      return;
    }
    checkUnfinished();
  };

  const confirmIncomplete = () => {
    const check = incomplete;
    setIncomplete(null);
    if (!check) return;
    if (check.kind === "session") {
      checkUnfinished();
      return;
    }
    const ex = exercises.find((e) => e.id === check.exId);
    if (ex) completeExercise(ex);
  };

  const restLeft = rest
    ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={() => navigate(`/rutinas/${routineId}`)}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Volver a la rutina
        </button>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{dayName}</h1>
            <p className="text-muted-foreground text-sm">
              {completedCount} de {exercises.length} ejercicios completados
            </p>
          </div>
          {startedAt === null ? (
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={startWorkout}
            >
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
              <div className="flex items-center">
                {/* Círculo: completar / descompletar sin abrir el ejercicio */}
                <button
                  type="button"
                  onClick={() => toggleQuickDone(ex)}
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
                  onClick={() => setOpenId(isOpen ? null : ex.id)}
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
                    <div>
                      <button
                        onClick={() =>
                          setHistoryOpen((h) => ({ ...h, [ex.id]: !h[ex.id] }))
                        }
                        className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
                      >
                        <History className="size-3.5" />
                        {historyLabel(ex.history.length)}
                        <ChevronDown
                          className={cn(
                            "size-3.5 transition-transform",
                            historyOpen[ex.id] && "rotate-180",
                          )}
                        />
                      </button>
                      {historyOpen[ex.id] && (
                        <div className="mt-2 space-y-1.5">
                          {ex.history.slice(0, HISTORY_PREVIEW).map((h, i) => (
                            <HistoryRow key={i} entry={h} />
                          ))}
                          {ex.history.length > HISTORY_PREVIEW && (
                            <button
                              type="button"
                              onClick={() => setHistoryDialog(ex)}
                              className="text-primary-text text-xs font-medium hover:underline"
                            >
                              Ver más
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Variante con la que lo hizo */}
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground text-xs font-medium">
                      Variante
                    </span>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="radiogroup"
                      aria-label="Variante"
                    >
                      {EXERCISE_VARIANTS.map((v) => {
                        const selected = variants[ex.id] === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() =>
                              setVariants((prev) => ({
                                ...prev,
                                [ex.id]: selected ? null : v,
                              }))
                            }
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inputs de series */}
                  <div className="space-y-2">
                    {ex.history[0] ? (
                      <p className="text-muted-foreground text-xs">
                        Precargado con tu entrenamiento del{" "}
                        {formatDate(ex.history[0].date)}. Si progresaste,
                        editalo.
                      </p>
                    ) : null}
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
                        {ex.restSeconds ? (
                          <Button
                            variant={row.done ? "default" : "outline"}
                            size="icon"
                            aria-label={
                              row.done
                                ? `Serie ${i + 1} hecha`
                                : `Marcar serie ${i + 1} como hecha y descansar`
                            }
                            aria-pressed={!!row.done}
                            onClick={() => toggleSetDone(ex, row)}
                          >
                            <Check className="size-4" />
                          </Button>
                        ) : null}
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
                    {/* Una línea; crece sola si el texto no entra. */}
                    <textarea
                      id={`note-${ex.id}`}
                      rows={1}
                      maxLength={NOTE_MAX_LENGTH}
                      value={notes[ex.id] ?? ""}
                      onChange={(e) => {
                        e.target.style.height = "auto";
                        e.target.style.height = `${e.target.scrollHeight}px`;
                        setNotes((n) => ({ ...n, [ex.id]: e.target.value }));
                      }}
                      placeholder="Ej: agarre cerrado"
                      className="border-input bg-input/40 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 block w-full resize-none overflow-hidden rounded-xl border px-3.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handleDone(ex)}
                    disabled={pending}
                  >
                    Guardar ejercicio
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Descanso + Guardar sesión */}
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
            <Button variant="outline" size="sm" onClick={() => adjustRest(-15)}>
              −15 s
            </Button>
            <Button variant="outline" size="sm" onClick={() => adjustRest(15)}>
              +15 s
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRest(null)}>
              Saltar
            </Button>
          </div>
        ) : null}
        <Button
          className="w-full"
          variant={completedCount > 0 ? "default" : "secondary"}
          onClick={handleCloseClick}
          disabled={pending || completedCount === 0}
        >
          Guardar sesión
        </Button>
      </div>

      <Dialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Todavía no terminaste</DialogTitle>
            <DialogDescription>
              {`Te quedan ${exercises.length - completedCount} ejercicios sin guardar. Se registran solo los ${completedCount} que guardaste. ¿Querés guardar la sesión igualmente?`}
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
              {pending ? "Guardando…" : "Guardar igualmente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Series con datos faltantes */}
      <Dialog
        open={incomplete !== null}
        onOpenChange={(o) => {
          if (!o) setIncomplete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Faltan datos en algunas series</DialogTitle>
            <DialogDescription>¿Guardar igualmente?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIncomplete(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmIncomplete}>Guardar igual</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progresión de volumen */}
      <Dialog
        open={progress !== null}
        onOpenChange={(o) => {
          if (!o) closeProgress();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="text-success size-5" /> ¡Progresaste!
            </DialogTitle>
            <DialogDescription>
              {progress
                ? `${progress.name}: +${progress.data.percent}% de volumen respecto a la última vez (${formatVolume(progress.data.before)} → ${formatVolume(progress.data.after)} kg).`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={closeProgress}>¡Vamos!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ¡Rutina completada! */}
      <Dialog
        open={finished !== null}
        onOpenChange={(o) => {
          if (!o) setFinished(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🎉 ¡Rutina completada!</DialogTitle>
            <DialogDescription>
              {finished?.elapsed != null
                ? `Tiempo total de entrenamiento: ${formatDuration(finished.elapsed)}.`
                : "Completaste todos los ejercicios del día."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setFinished(null)}
              disabled={pending}
            >
              Seguir editando
            </Button>
            <Button onClick={doClose} disabled={pending}>
              {pending ? "Guardando…" : "Guardar entrenamiento"}
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
              Para guardarlo, usá &quot;Guardar sesión&quot;.
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
                // Salida a propósito: el respaldo y el cronómetro ya no hacen falta.
                clearDraft(storage(), draftId);
                clearDraft(storage(), timerId);
                if (target) leave(target);
              }}
            >
              Salir sin guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sesión anterior sin guardar (la app/pestaña se cerró de golpe) */}
      <Dialog open={pendingDraft !== null}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Tenés una sesión sin guardar</DialogTitle>
            <DialogDescription>
              {pendingDraft ? describeDraft(pendingDraft) : ""} ¿Querés
              continuarla o empezar de nuevo?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={discardDraft}>
              Descartar
            </Button>
            <Button onClick={() => pendingDraft && restoreDraft(pendingDraft)}>
              Continuar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historial completo de un ejercicio ("Ver más") */}
      <Dialog
        open={historyDialog !== null}
        onOpenChange={(o) => {
          if (!o) setHistoryDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{historyDialog?.name}</DialogTitle>
            <DialogDescription>
              {historyDialog ? historyLabel(historyDialog.history.length) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-1 max-h-[60vh] space-y-1.5 overflow-y-auto px-1">
            {historyDialog?.history.map((h, i) => (
              <HistoryRow key={i} entry={h} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="bg-muted/40 rounded-md px-3 py-2 text-xs">
      <span className="text-muted-foreground mr-2 font-medium">
        {formatDate(entry.date)}
      </span>
      {summarizeHistory(entry)}
    </div>
  );
}
