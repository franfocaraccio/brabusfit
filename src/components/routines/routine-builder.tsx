"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createRoutine, updateRoutine } from "@/lib/actions/routines";
import type { Folder, RoutineDayInput } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExerciseDraft = { key: string; id?: string; name: string; sets_reps: string };
type DayDraft = { key: string; id?: string; name: string; exercises: ExerciseDraft[] };

const NO_FOLDER = "__root__";
const newKey = () => crypto.randomUUID();

function emptyExercise(): ExerciseDraft {
  return { key: newKey(), name: "", sets_reps: "" };
}
function emptyDay(): DayDraft {
  return { key: newKey(), name: "", exercises: [emptyExercise()] };
}

export type RoutineBuilderInitial = {
  id: string;
  name: string;
  folderId: string | null;
  days: DayDraft[];
};

export function RoutineBuilder({
  folders,
  initial,
}: {
  folders: Folder[];
  initial?: RoutineBuilderInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [folderId, setFolderId] = useState<string>(
    initial?.folderId ?? NO_FOLDER,
  );
  const [days, setDays] = useState<DayDraft[]>(initial?.days ?? [emptyDay()]);

  const isEdit = Boolean(initial);

  // --- mutadores de estado ---------------------------------------------------
  const updateDay = (key: string, patch: Partial<DayDraft>) =>
    setDays((d) => d.map((day) => (day.key === key ? { ...day, ...patch } : day)));

  const addDay = () => setDays((d) => [...d, emptyDay()]);
  const removeDay = (key: string) =>
    setDays((d) => d.filter((day) => day.key !== key));

  const addExercise = (dayKey: string) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? { ...day, exercises: [...day.exercises, emptyExercise()] }
          : day,
      ),
    );

  const updateExercise = (
    dayKey: string,
    exKey: string,
    patch: Partial<ExerciseDraft>,
  ) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              exercises: day.exercises.map((ex) =>
                ex.key === exKey ? { ...ex, ...patch } : ex,
              ),
            }
          : day,
      ),
    );

  const removeExercise = (dayKey: string, exKey: string) =>
    setDays((d) =>
      d.map((day) =>
        day.key === dayKey
          ? { ...day, exercises: day.exercises.filter((ex) => ex.key !== exKey) }
          : day,
      ),
    );

  // --- guardar ---------------------------------------------------------------
  const handleSubmit = () => {
    const payloadDays: RoutineDayInput[] = days.map((day) => ({
      id: day.id,
      name: day.name.trim(),
      exercises: day.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name.trim(),
        sets_reps: ex.sets_reps.trim(),
      })),
    }));

    const payload = {
      name: name.trim(),
      folderId: folderId === NO_FOLDER ? null : folderId,
      days: payloadDays,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateRoutine(initial!.id, payload)
        : await createRoutine(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Rutina actualizada" : "Rutina creada");
      router.push(`/rutinas/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="routine-name">Nombre de la rutina</Label>
          <Input
            id="routine-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Junio 2026 4 días"
          />
        </div>

        <div className="space-y-2">
          <Label>Carpeta (opcional)</Label>
          <Select
            value={folderId}
            onValueChange={(v) => setFolderId(v ?? NO_FOLDER)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sin carpeta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FOLDER}>Sin carpeta (raíz)</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {days.map((day, dayIdx) => (
          <Card key={day.key}>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`day-${day.key}`}>Día {dayIdx + 1}</Label>
                  <Input
                    id={`day-${day.key}`}
                    value={day.name}
                    onChange={(e) => updateDay(day.key, { name: e.target.value })}
                    placeholder="Día 1 - Piernas"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar día"
                  onClick={() => removeDay(day.key)}
                  disabled={days.length === 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {day.exercises.map((ex) => (
                  <div
                    key={ex.key}
                    className="bg-muted/30 flex items-start gap-2 rounded-md border p-3"
                  >
                    <GripVertical className="text-muted-foreground mt-2.5 size-4 shrink-0" />
                    <div className="grid flex-1 gap-2">
                      <Input
                        value={ex.name}
                        onChange={(e) =>
                          updateExercise(day.key, ex.key, { name: e.target.value })
                        }
                        placeholder="Press Militar"
                      />
                      <Input
                        value={ex.sets_reps}
                        onChange={(e) =>
                          updateExercise(day.key, ex.key, {
                            sets_reps: e.target.value,
                          })
                        }
                        placeholder="4 x (10 a 12)"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar ejercicio"
                      onClick={() => removeExercise(day.key, ex.key)}
                      disabled={day.exercises.length === 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => addExercise(day.key)}
              >
                <Plus className="size-4" /> Agregar ejercicio
              </Button>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={addDay}
        >
          <Plus className="size-4" /> Agregar día
        </Button>
      </div>

      <div className="bg-background/90 sticky bottom-16 z-20 -mx-4 border-t px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        <Button
          type="button"
          className="w-full"
          onClick={handleSubmit}
          disabled={pending}
        >
          {pending
            ? "Guardando…"
            : isEdit
              ? "Guardar cambios"
              : "Crear rutina"}
        </Button>
      </div>
    </div>
  );
}
