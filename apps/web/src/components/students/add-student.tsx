"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { usernameError, type AddStudentStatus } from "@brabus/shared";

import { addStudent, checkAddStudent } from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "email" | "username";

const FEEDBACK: Partial<Record<AddStudentStatus, { text: string; cls: string }>> = {
  self: { text: "No podés agregarte a vos mismo.", cls: "text-destructive" },
  coach: { text: "No podés agregar a un coach como alumno.", cls: "text-destructive" },
  not_found: { text: "No existe un usuario con ese nombre.", cls: "text-destructive" },
  already: { text: "Ya es tu alumno (o tiene la invitación pendiente).", cls: "text-amber-500" },
  existing: { text: "Usuario encontrado: le va a llegar la invitación.", cls: "text-emerald-500" },
  new: {
    text: "Todavía no tiene cuenta: va a ver la invitación cuando se registre.",
    cls: "text-muted-foreground",
  },
};

/** Botón + diálogo para agregar un alumno (queda con invitación pendiente). */
export function AddStudent({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<Mode>("username");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<AddStudentStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, startTransition] = useTransition();

  const looksValid = (v: string, m: Mode) =>
    m === "email" ? /.+@.+\..+/.test(v.trim()) : !usernameError(v.trim());

  useEffect(() => {
    const v = value.trim();
    if (!v || !looksValid(v, mode)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await checkAddStudent(mode, v);
      if (!cancelled) {
        setStatus(result);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, mode]);

  const reset = (m: Mode = mode) => {
    setMode(m);
    setValue("");
    setStatus(null);
    setChecking(false);
  };

  const onChange = (raw: string) => {
    const v = mode === "username" ? raw.toLowerCase() : raw;
    setValue(v);
    setStatus(null);
    setChecking(v.trim() !== "" && looksValid(v, mode));
  };

  const canAdd = !pending && !checking && (status === "existing" || status === "new");

  const submit = () => {
    if (!canAdd) return;
    startTransition(async () => {
      const result = await addStudent(mode, value.trim());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitación enviada. Va a ver todo cuando la acepte.");
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  const v = value.trim();
  const feedback = checking
    ? { text: "Verificando…", cls: "text-muted-foreground" }
    : v && !looksValid(v, mode)
      ? {
          text: mode === "username" ? (usernameError(v) ?? "") : "Email inválido.",
          cls: "text-destructive",
        }
      : status
        ? FEEDBACK[status]
        : undefined;

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Agregar alumno
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar alumno</DialogTitle>
            <DialogDescription>
              Le llega una invitación. Mientras tanto ya podés armarle rutinas: las va a ver
              cuando la acepte.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted inline-flex w-fit rounded-lg p-0.5">
            {(["username", "email"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => reset(m)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  mode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "email" ? "Email" : "Usuario"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-student">
              {mode === "email" ? "Email del alumno" : "Nombre de usuario"}
            </Label>
            <div className="flex gap-2">
              <Input
                id="add-student"
                type={mode === "email" ? "email" : "text"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={mode === "email" ? "alumno@email.com" : "juan.perez"}
                autoCapitalize="none"
                autoComplete="off"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              <Button onClick={submit} disabled={!canAdd}>
                Agregar
              </Button>
            </div>
            {feedback ? <p className={`text-xs ${feedback.cls}`}>{feedback.text}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
