"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { MyCoach } from "@brabus/supabase";

import { respondInvitation } from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISSED_KEY = "brabus:invitations-dismissed";

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Popup al abrir la app cuando un coach invitó al alumno. "Ahora no" lo oculta
 * hasta la próxima vez que abra la app (sessionStorage); la invitación sigue
 * marcada en el Perfil y en Inicio.
 */
export function InvitationsGate({ invitations }: { invitations: MyCoach[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage solo existe en el cliente
    setDismissed(readDismissed());
  }, []);

  const current = dismissed ? invitations.find((i) => !dismissed.includes(i.linkId)) : undefined;
  if (!current) return null;

  const later = () => {
    const next = [...(dismissed ?? []), current.linkId];
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // sin storage: se oculta solo en esta vista
    }
    setDismissed(next);
  };

  const respond = (accept: boolean) =>
    startTransition(async () => {
      const result = await respondInvitation(current.linkId, accept);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(accept ? `Ahora entrenás con ${current.name}` : "Invitación rechazada");
      setDismissed((d) => [...(d ?? []), current.linkId]);
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && later()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Te invitaron a un grupo de entrenamiento</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{current.name}</strong>
            {current.username ? ` (@${current.username})` : ""} te agregó como alumno. Si aceptás,
            vas a ver todo lo que te comparta y va a poder seguir tu progreso.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={later} disabled={pending}>
            Ahora no
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => respond(false)} disabled={pending}>
              Rechazar
            </Button>
            <Button onClick={() => respond(true)} disabled={pending}>
              Aceptar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
