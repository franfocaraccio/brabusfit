"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteNutritionFolder } from "@/lib/actions/nutrition";
import { deleteFolder } from "@/lib/actions/routines";
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

export function FolderActions({
  folderId,
  folderName,
  kind = "routines",
}: {
  folderId: string;
  folderName: string;
  kind?: "routines" | "nutrition";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const result =
        kind === "nutrition" ? await deleteNutritionFolder(folderId) : await deleteFolder(folderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Carpeta eliminada");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar carpeta"
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar carpeta</DialogTitle>
          <DialogDescription>
            Se eliminará la carpeta «{folderName}». {kind === "nutrition" ? "Los planes" : "Las rutinas"} que contiene no
            se borran: pasan a la raíz.
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
