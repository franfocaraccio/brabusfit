"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteRoutine } from "@/lib/actions/routines";
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

export function DeleteRoutineButton({
  routineId,
  routineName,
}: {
  routineId: string;
  routineName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await deleteRoutine(routineId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Rutina eliminada");
      setOpen(false);
      router.push("/rutinas");
      router.refresh();
    });
  };

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
          <DialogTitle>Eliminar rutina</DialogTitle>
          <DialogDescription>
            Se eliminará «{routineName}» y todos sus días y ejercicios. Esta
            acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={remove} disabled={pending}>
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
