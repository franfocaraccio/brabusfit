"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import type { ShareTarget } from "@brabus/supabase";

import { setRoutineShare } from "@/lib/actions/students";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Compartir una rutina eligiendo entre los alumnos del coach. */
export function ShareRoutine({
  routineId,
  targets,
}: {
  routineId: string;
  targets: ShareTarget[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const sharedCount = targets.filter((t) => t.shared).length;

  const toggle = (t: ShareTarget) => {
    setBusy(t.linkId);
    startTransition(async () => {
      const result = await setRoutineShare(routineId, t.linkId, !t.shared);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.shared ? `Se dejó de compartir con ${t.name}` : `Compartida con ${t.name}`);
      router.refresh();
    });
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="size-4" /> Compartir
            {sharedCount > 0 ? (
              <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-xs">
                {sharedCount}
              </span>
            ) : null}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartir rutina</DialogTitle>
          <DialogDescription>
            Elegí con cuáles de tus alumnos compartirla. Los que tienen la invitación pendiente la
            van a ver cuando la acepten.
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no tenés alumnos.</p>
        ) : (
          <div className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
            {targets.map((t) => (
              <button
                key={t.linkId}
                type="button"
                onClick={() => toggle(t)}
                disabled={pending}
                className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-60"
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border",
                    t.shared && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {t.shared ? <Check className="size-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {t.username ? `@${t.username}` : t.email}
                    {t.status === "pending" ? " · Invitación pendiente" : ""}
                  </span>
                </span>
                {busy === t.linkId ? (
                  <span className="text-muted-foreground text-xs">…</span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        <Link
          href="/alumnos?agregar=1"
          className={cn(buttonVariants({ variant: "outline" }), "w-full gap-1.5")}
        >
          <UserPlus className="size-4" /> Agregar alumno
        </Link>
      </DialogContent>
    </Dialog>
  );
}
