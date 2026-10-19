"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  NOTE_MAX_LENGTH,
  parseSetRows,
  sanitizeDecimal,
  setsToRows,
  type SessionLogUpdate,
} from "@brabus/shared";
import type { SessionDetail } from "@brabus/supabase";

import { deleteSession, updateSession } from "@/lib/actions/history";
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

type Row = { key: string; weight: string; reps: string };
type LogState = {
  id: string;
  exerciseName: string;
  setsReps: string;
  note: string;
  rows: Row[];
};

const newKey = () => crypto.randomUUID();

function initialState(session: SessionDetail): LogState[] {
  return session.logs.map((l) => ({
    id: l.id,
    exerciseName: l.exerciseName,
    setsReps: l.setsReps,
    note: l.note ?? "",
    rows: (l.sets.length ? setsToRows(l.sets) : [{ weight: "", reps: "" }]).map((r) => ({
      key: newKey(),
      ...r,
    })),
  }));
}

/** Lo que se manda a guardar (y sirve para saber si hubo cambios). */
function toPayload(logs: LogState[]): SessionLogUpdate[] {
  return logs.map((l) => ({
    log_id: l.id,
    note: l.note.trim() || null,
    sets: parseSetRows(l.rows),
  }));
}

/** Editar una sesión pasada: series, detalle, o eliminarla entera. */
export function SessionEditor({ session }: { session: SessionDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logs, setLogs] = useState<LogState[]>(() => initialState(session));
  // Último estado guardado (para saber si hay cambios sin guardar).
  const [savedPayload, setSavedPayload] = useState(() =>
    JSON.stringify(toPayload(initialState(session))),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = JSON.stringify(toPayload(logs)) !== savedPayload;

  const updateLog = (id: string, patch: (l: LogState) => LogState) =>
    setLogs((ls) => ls.map((l) => (l.id === id ? patch(l) : l)));

  const setRow = (logId: string, key: string, patch: Partial<Row>) =>
    updateLog(logId, (l) => ({
      ...l,
      rows: l.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));

  const save = () =>
    startTransition(async () => {
      const payload = toPayload(logs);
      const result = await updateSession(session.id, session.routineId, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedPayload(JSON.stringify(payload));
      toast.success("Sesión actualizada");
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteSession(session.id, session.routineId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sesión eliminada");
      router.push(`/rutinas/${session.routineId}/historial`);
    });

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      {logs.map((l) => (
        <Card key={l.id} className="space-y-3 p-4">
          <div>
            <p className="font-semibold">{l.exerciseName}</p>
            {l.setsReps ? (
              <p className="text-muted-foreground text-xs">{l.setsReps}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            {l.rows.map((row, i) => (
              <div key={row.key} className="flex items-center gap-2">
                <span className="text-muted-foreground w-14 shrink-0 text-xs">
                  Serie {i + 1}
                </span>
                <div className="relative flex-1">
                  <DecimalInput
                    placeholder="Peso"
                    value={row.weight}
                    onChange={(e) =>
                      setRow(l.id, row.key, { weight: sanitizeDecimal(e.target.value) })
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
                    setRow(l.id, row.key, { reps: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar serie"
                  onClick={() =>
                    updateLog(l.id, (x) => ({
                      ...x,
                      rows: x.rows.filter((r) => r.key !== row.key),
                    }))
                  }
                  disabled={l.rows.length === 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                updateLog(l.id, (x) => ({
                  ...x,
                  rows: [...x.rows, { key: newKey(), weight: "", reps: "" }],
                }))
              }
            >
              <Plus className="size-4" /> Agregar serie
            </Button>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`note-${l.id}`}
              className="text-muted-foreground text-xs font-medium"
            >
              Detalle (opcional)
            </label>
            <textarea
              id={`note-${l.id}`}
              rows={1}
              maxLength={NOTE_MAX_LENGTH}
              value={l.note}
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              onChange={(e) => updateLog(l.id, (x) => ({ ...x, note: e.target.value }))}
              placeholder="Ej: hecho en Smith"
              className="border-input bg-input/40 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 block w-full resize-none overflow-hidden rounded-xl border px-3.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3"
            />
          </div>
        </Card>
      ))}

      {logs.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground text-sm">Esta sesión no tiene ejercicios.</p>
        </Card>
      )}

      <div className="bg-background/90 fixed inset-x-0 bottom-16 z-30 flex gap-2 border-t px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <Button
          variant="destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
        >
          <Trash2 className="size-4" /> Eliminar
        </Button>
        <Button className="flex-1" onClick={save} disabled={pending || !dirty}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar sesión</DialogTitle>
            <DialogDescription>
              Se eliminará este entrenamiento con todas sus series. Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
