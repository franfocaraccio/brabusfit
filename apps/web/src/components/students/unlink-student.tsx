"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { unlinkStudent } from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Desvincular un alumno (o cancelar su invitación). Las rutinas que el coach
 * le armó le quedan guardadas al coach; el alumno deja de verlas.
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
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await unlinkStudent(linkId);
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
  const routinesText =
    routineCount === 0
      ? null
      : routineCount === 1
        ? "La rutina que le armaste te queda guardada, pero el alumno deja de verla."
        : `Las ${routineCount} rutinas que le armaste te quedan guardadas, pero el alumno deja de verlas.`;

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
                ? "Se borra la invitación."
                : "Deja de ser tu alumno: ya no vas a ver su progreso ni sus entrenamientos."}
              {routinesText ? ` ${routinesText}` : null}
            </DialogDescription>
          </DialogHeader>

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
