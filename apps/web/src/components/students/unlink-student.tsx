"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { unlinkStudent } from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/**
 * Desvincular un alumno (o cancelar su invitación). Con el alumno activo, el
 * coach elige si le deja las rutinas compartidas.
 */
export function UnlinkStudent({
  linkId,
  name,
  pending: isPending,
  routineCount,
  redirectTo,
  size = "sm",
}: {
  linkId: string;
  name: string;
  pending: boolean;
  routineCount: number;
  redirectTo?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keepRoutines, setKeepRoutines] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await unlinkStudent(linkId, !isPending && keepRoutines);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isPending ? "Invitación cancelada" : `${name} ya no es tu alumno`);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });

  const label = isPending ? "Cancelar invitación" : "Desvincular";

  return (
    <>
      <Button variant="ghost" size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPending ? `Cancelar la invitación a ${name}` : `Desvincular a ${name}`}
            </DialogTitle>
            <DialogDescription>
              {isPending
                ? "Se borra la invitación y lo que le compartiste mientras estaba pendiente."
                : "Deja de ser tu alumno: ya no vas a ver su progreso ni sus entrenamientos."}
            </DialogDescription>
          </DialogHeader>

          {!isPending && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">¿Qué conserva?</p>
              <div className="bg-muted/40 flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id={`keep-routines-${linkId}`}
                  checked={keepRoutines}
                  onCheckedChange={(v) => setKeepRoutines(Boolean(v))}
                  className="mt-0.5"
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor={`keep-routines-${linkId}`}>Seguir compartiéndole sus rutinas</Label>
                  <p className="text-muted-foreground text-xs">
                    {routineCount === 0
                      ? "Hoy no tiene rutinas tuyas."
                      : `Conserva ${routineCount === 1 ? "la rutina" : `las ${routineCount} rutinas`} que le compartiste.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Volver
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "…" : label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
