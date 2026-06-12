"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Share2, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";

import {
  checkShareEmail,
  checkShareUsername,
  shareRoutine,
  shareRoutineByUsername,
  unshareRoutine,
} from "@/lib/actions/shares";
import { usernameError } from "@/lib/username";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ShareRow = {
  id: string;
  shared_with_email: string;
  status: "pending" | "accepted";
  student: { first_name: string; last_name: string } | null;
};

type Mode = "email" | "username";

export function ShareRoutine({
  routineId,
  shares,
}: {
  routineId: string;
  shares: ShareRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("email");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, startTransition] = useTransition();

  const looksValid = (v: string) =>
    mode === "email" ? /.+@.+\..+/.test(v.trim()) : !usernameError(v.trim());

  // Validación en vivo (debounced) según el modo.
  useEffect(() => {
    const v = value.trim();
    if (!v || !looksValid(v)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result =
        mode === "email"
          ? await checkShareEmail(routineId, v)
          : await checkShareUsername(routineId, v);
      if (!cancelled) {
        setStatus(result);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode, routineId]);

  const onChange = (raw: string) => {
    const v = mode === "username" ? raw.toLowerCase() : raw;
    setValue(v);
    setStatus(null);
    setChecking(v.trim() !== "" && looksValid(v));
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setValue("");
    setStatus(null);
    setChecking(false);
  };

  // El botón se habilita SOLO cuando el destino es realmente compartible.
  const canShare =
    !pending &&
    !checking &&
    (mode === "email"
      ? status === "existing" || status === "new"
      : status === "existing");

  const submit = () => {
    const v = value.trim();
    if (!canShare || !v) return;
    startTransition(async () => {
      const result =
        mode === "email"
          ? await shareRoutine(routineId, v)
          : await shareRoutineByUsername(routineId, v);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.existed
          ? "Rutina compartida. Le avisamos por email."
          : "Invitación enviada. Se vinculará cuando cree su cuenta.",
      );
      setValue("");
      setStatus(null);
      setChecking(false);
      router.refresh();
    });
  };

  const remove = (shareId: string) => {
    startTransition(async () => {
      const result = await unshareRoutine(shareId, routineId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Se dejó de compartir");
      router.refresh();
    });
  };

  const feedback = ((): { text: string; cls: string } | null => {
    const v = value.trim();
    if (checking) return { text: "Verificando…", cls: "text-muted-foreground" };
    if (v && !looksValid(v)) {
      return mode === "username"
        ? { text: usernameError(v) ?? "", cls: "text-destructive" }
        : { text: "Email inválido.", cls: "text-destructive" };
    }
    switch (status) {
      case "self":
        return {
          text: mode === "email" ? "Ese es tu propio email." : "Ese sos vos.",
          cls: "text-destructive",
        };
      case "coach":
        return {
          text: "No podés compartir una rutina con un coach.",
          cls: "text-destructive",
        };
      case "not_found":
        return {
          text: "No existe un usuario con ese nombre.",
          cls: "text-destructive",
        };
      case "already":
        return {
          text: "Ya está compartida con ese destinatario.",
          cls: "text-amber-500",
        };
      case "existing":
        return {
          text: "Usuario encontrado — le llega al instante.",
          cls: "text-emerald-500",
        };
      case "new":
        return {
          text: "Se le enviará una invitación para crear su cuenta.",
          cls: "text-muted-foreground",
        };
      default:
        return null;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="size-4" /> Compartir
            {shares.length > 0 ? (
              <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-xs">
                {shares.length}
              </span>
            ) : null}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartir rutina</DialogTitle>
          <DialogDescription>
            Compartí con tu alumno por email o por nombre de usuario.
          </DialogDescription>
        </DialogHeader>

        {/* Selector de modo */}
        <div className="bg-muted inline-flex w-fit rounded-lg p-0.5">
          {(["email", "username"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
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
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="share-input">
                {mode === "email" ? "Email del alumno" : "Nombre de usuario"}
              </Label>
              <Input
                id="share-input"
                type={mode === "email" ? "email" : "text"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={
                  mode === "email" ? "alumno@email.com" : "juan.perez"
                }
                autoCapitalize="none"
                autoComplete="off"
                aria-invalid={Boolean(feedback && feedback.cls.includes("destructive"))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>
            <Button onClick={submit} disabled={!canShare}>
              Compartir
            </Button>
          </div>
          {feedback ? (
            <p className={`text-xs ${feedback.cls}`}>{feedback.text}</p>
          ) : null}
        </div>

        {shares.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold">
              Compartida con
            </p>
            <div className="divide-y rounded-md border">
              {shares.map((s) => {
                const name = s.student
                  ? `${s.student.first_name} ${s.student.last_name}`.trim()
                  : s.shared_with_email;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm"
                  >
                    {s.status === "accepted" ? (
                      <UserCheck className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Clock className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="text-muted-foreground text-xs">
                        {s.status === "accepted"
                          ? s.shared_with_email
                          : `${s.shared_with_email} · Pendiente`}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Dejar de compartir"
                      onClick={() => remove(s.id)}
                      disabled={pending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
