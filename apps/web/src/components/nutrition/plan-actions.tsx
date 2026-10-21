"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deletePlan, setCurrentPlan } from "@/lib/actions/nutrition";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Marca el plan como vigente para su cliente. */
export function SetCurrentPlanButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setCurrentPlan(planId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Marcado como plan vigente");
          router.refresh();
        })
      }
    >
      <Star className="size-4" /> Marcar vigente
    </Button>
  );
}

export function DeletePlanButton({
  planId,
  planName,
  redirectTo,
}: {
  planId: string;
  planName: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const result = await deletePlan(planId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Plan eliminado");
      setOpen(false);
      router.push(redirectTo);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm" className="gap-1.5">
            <Trash2 className="size-4" /> Eliminar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar plan</DialogTitle>
          <DialogDescription>
            Se eliminará «{planName}» con todas sus comidas. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={remove} disabled={pending}>
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
