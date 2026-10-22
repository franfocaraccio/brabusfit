"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { copyPlan } from "@/lib/actions/nutrition";
import { copyRoutine } from "@/lib/actions/routines";
import { Button } from "@/components/ui/button";

/** Duplica una plantilla (rutina o plan) como otra plantilla: "Nombre (copia)". */
export function DuplicateButton({
  kind,
  id,
}: {
  kind: "routine" | "nutrition";
  id: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const duplicate = () =>
    startTransition(async () => {
      const result =
        kind === "nutrition"
          ? await copyPlan(id, null)
          : await copyRoutine(id, null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        kind === "nutrition" ? "Plan duplicado" : "Rutina duplicada",
      );
      router.push(
        `${kind === "nutrition" ? "/nutricion" : "/rutinas"}/${result.data.id}`,
      );
    });

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={duplicate}
    >
      <Copy className="size-4" /> {pending ? "Duplicando…" : "Duplicar"}
    </Button>
  );
}
