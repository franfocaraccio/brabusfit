"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { MyCoach } from "@brabus/supabase";

import { leaveCoach, respondInvitation } from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Perfil del alumno: invitaciones pendientes y coaches con los que entrena. */
export function MyCoaches({ coaches }: { coaches: MyCoach[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState<MyCoach | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo completar la acción.");
        return;
      }
      toast.success(success);
      setLeaving(null);
      router.refresh();
    });

  if (coaches.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no entrenás con ningún coach. Cuando uno te agregue, vas a ver la invitación acá.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {coaches.map((c) => (
        <div key={c.linkId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{c.name}</p>
            <p className="text-muted-foreground text-xs">
              {c.username ? `@${c.username} · ` : ""}
              {c.status === "pending" ? "Te invitó a su grupo" : "Tu coach"}
            </p>
          </div>
          {c.status === "pending" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => respondInvitation(c.linkId, false), "Invitación rechazada")}
              >
                Rechazar
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => respondInvitation(c.linkId, true), `Ahora entrenás con ${c.name}`)
                }
              >
                Aceptar
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setLeaving(c)}>
              Desvincular
            </Button>
          )}
        </div>
      ))}

      <Dialog open={leaving !== null} onOpenChange={(o) => !o && setLeaving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desvincularte de {leaving?.name}</DialogTitle>
            <DialogDescription>
              Vas a dejar de ver todo lo que {leaving?.name} te compartió (rutinas y lo que
              agregue más adelante) y no va a poder seguir tu progreso. Tus entrenamientos
              guardados siguen siendo tuyos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeaving(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => leaving && run(() => leaveCoach(leaving.linkId), "Te desvinculaste")}
            >
              {pending ? "Desvinculando…" : "Desvincularme"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
