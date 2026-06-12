"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Share2, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";

import {
  checkShareEmail,
  shareRoutine,
  unshareRoutine,
} from "@/lib/actions/shares";
import type { ShareEmailStatus } from "@/lib/supabase/types";
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

export type ShareRow = {
  id: string;
  shared_with_email: string;
  status: "pending" | "accepted";
  student: { first_name: string; last_name: string } | null;
};

export function ShareRoutine({
  routineId,
  shares,
}: {
  routineId: string;
  shares: ShareRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<ShareEmailStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, startTransition] = useTransition();

  const looksLikeEmail = (v: string) => /.+@.+\..+/.test(v.trim());

  // Validación en vivo (debounced). El reset inmediato se hace en onChange
  // (event handler); el effect solo agenda el chequeo async.
  useEffect(() => {
    if (!looksLikeEmail(email)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await checkShareEmail(routineId, email.trim());
      if (!cancelled) {
        setStatus(result);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [email, routineId]);

  const onEmailChange = (v: string) => {
    setEmail(v);
    setStatus(null);
    setChecking(looksLikeEmail(v));
  };

  // Estados que impiden compartir.
  const blocked =
    status === "self" ||
    status === "coach" ||
    status === "invalid" ||
    status === "forbidden";

  const submit = () => {
    const value = email.trim();
    if (!value || blocked) return;
    startTransition(async () => {
      const result = await shareRoutine(routineId, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.existed
          ? "Rutina compartida. Le avisamos por email."
          : "Invitación enviada. Se vinculará cuando cree su cuenta.",
      );
      setEmail("");
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

  const feedback: { text: string; cls: string } | null = checking
    ? { text: "Verificando…", cls: "text-muted-foreground" }
    : status === "self"
      ? { text: "Ese es tu propio email.", cls: "text-destructive" }
      : status === "coach"
        ? {
            text: "No podés compartir una rutina con un coach.",
            cls: "text-destructive",
          }
        : status === "invalid"
          ? { text: "Email inválido.", cls: "text-destructive" }
          : status === "already"
            ? {
                text: "Ya está compartida con este email.",
                cls: "text-amber-500",
              }
            : status === "existing"
              ? {
                  text: "Usuario encontrado — le llega al instante.",
                  cls: "text-emerald-500",
                }
              : status === "new"
                ? {
                    text: "Se le enviará una invitación para crear su cuenta.",
                    cls: "text-muted-foreground",
                  }
                : null;

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
            Ingresá el email de tu alumno. Si ya tiene cuenta la verá al
            instante; si no, le enviamos una invitación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="share-email">Email del alumno</Label>
              <Input
                id="share-email"
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="alumno@email.com"
                aria-invalid={blocked}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>
            <Button
              onClick={submit}
              disabled={pending || checking || !email.trim() || blocked}
            >
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
