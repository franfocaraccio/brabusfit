"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

import { createFolder } from "@/lib/actions/routines";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewFolderButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await createFolder(name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Carpeta creada");
      setName("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5">
            <FolderPlus className="size-4" /> Nueva carpeta
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="folder-name">Nombre</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alumnos 2026"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "Creando…" : "Crear carpeta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
