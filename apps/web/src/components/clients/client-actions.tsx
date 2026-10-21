"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Smartphone, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";

import { usernameError, type AppAccess, type InviteStatus } from "@brabus/shared";

import {
  checkInviteClient,
  deleteClient,
  inviteClient,
  removeClientAccess,
  setClientArchived,
} from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "email" | "username";

const FEEDBACK: Partial<Record<InviteStatus, { text: string; cls: string }>> = {
  self: { text: "No podés invitarte a vos mismo.", cls: "text-destructive" },
  coach: { text: "No podés invitar a un coach como cliente.", cls: "text-destructive" },
  not_found: { text: "No existe un usuario con ese nombre.", cls: "text-destructive" },
  already: { text: "Otro de tus clientes ya usa esa cuenta o email.", cls: "text-amber-500" },
  existing: { text: "Usuario encontrado: le va a llegar la invitación.", cls: "text-emerald-500" },
  new: {
    text: "Todavía no tiene cuenta: va a ver la invitación cuando se registre con ese email.",
    cls: "text-muted-foreground",
  },
};

/** Diálogo para invitar la ficha a usar la app (por usuario o email). */
function InviteDialog({
  clientId,
  name,
  defaultEmail,
  open,
  onOpenChange,
}: {
  clientId: string;
  name: string;
  defaultEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultEmail ? "email" : "username");
  const [value, setValue] = useState(defaultEmail);
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [checking, setChecking] = useState(Boolean(defaultEmail));
  const [pending, startTransition] = useTransition();

  const looksValid = (v: string, m: Mode) =>
    m === "email" ? /.+@.+\..+/.test(v.trim()) : !usernameError(v.trim());

  useEffect(() => {
    const v = value.trim();
    if (!open || !v || !looksValid(v, mode)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await checkInviteClient(clientId, mode, v);
      if (!cancelled) {
        setStatus(result);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, mode, open, clientId]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setValue(m === "email" ? defaultEmail : "");
    setStatus(null);
    setChecking(m === "email" && Boolean(defaultEmail));
  };

  const onChange = (raw: string) => {
    const v = mode === "username" ? raw.toLowerCase() : raw;
    setValue(v);
    setStatus(null);
    setChecking(v.trim() !== "" && looksValid(v, mode));
  };

  const canInvite = !pending && !checking && (status === "existing" || status === "new");

  const submit = () => {
    if (!canInvite) return;
    startTransition(async () => {
      const result = await inviteClient(clientId, mode, value.trim());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitación enviada. Va a ver sus rutinas cuando la acepte.");
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar a {name} a la app</DialogTitle>
          <DialogDescription>
            Cuando acepte va a ver las rutinas que le armaste y vas a poder seguir su progreso. La
            ficha y tus notas siguen siendo privadas.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted inline-flex w-fit rounded-lg p-0.5">
          {(["username", "email"] as Mode[]).map((m) => (
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
          <Label htmlFor="invite-client">{mode === "email" ? "Email" : "Nombre de usuario"}</Label>
          <div className="flex gap-2">
            <Input
              id="invite-client"
              type={mode === "email" ? "email" : "text"}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={mode === "email" ? "cliente@email.com" : "juan.perez"}
              autoCapitalize="none"
              autoComplete="off"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <Button onClick={submit} disabled={!canInvite}>
              Invitar
            </Button>
          </div>
          {feedback ? <p className={`text-xs ${feedback.cls}`}>{feedback.text}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Confirm = "access" | "archive" | "delete" | null;

/** Acciones de la ficha: invitar / quitar acceso, archivar, eliminar. */
export function ClientActions({
  clientId,
  name,
  email,
  appAccess,
  archived,
  routineCount,
}: {
  clientId: string;
  name: string;
  email: string;
  appAccess: AppAccess;
  archived: boolean;
  routineCount: number;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [pending, startTransition] = useTransition();

  const keepsCopy =
    appAccess === "active" && routineCount > 0
      ? ` Se queda con una copia propia de ${routineCount === 1 ? "la rutina" : `las ${routineCount} rutinas`} que le armaste, y vos conservás las tuyas.`
      : "";

  const dialogs: Record<Exclude<Confirm, null>, { title: string; text: string; cta: string }> = {
    access: {
      title: appAccess === "pending" ? "Cancelar la invitación" : `Quitarle la app a ${name}`,
      text:
        appAccess === "pending"
          ? "La ficha queda como cliente sin app."
          : `Ya no vas a ver su progreso ni sus entrenamientos. La ficha queda como cliente sin app.${keepsCopy}`,
      cta: appAccess === "pending" ? "Cancelar invitación" : "Quitar acceso",
    },
    archive: {
      title: archived ? `Reactivar a ${name}` : `Archivar a ${name}`,
      text: archived
        ? "Vuelve a tu lista de clientes activos."
        : `Pasa a Archivados con sus datos y rutinas.${appAccess !== "none" ? " También se le quita el acceso a la app." : ""}${keepsCopy}`,
      cta: archived ? "Reactivar" : "Archivar",
    },
    delete: {
      title: `Eliminar a ${name}`,
      text: `Se borra la ficha y ${routineCount === 1 ? "la rutina que le armaste" : `las ${routineCount} rutinas que le armaste`}. No se puede deshacer.${keepsCopy ? " Como usa la app, antes se queda con su copia." : ""}`,
      cta: "Eliminar",
    },
  };

  const run = () =>
    startTransition(async () => {
      const result =
        confirm === "access"
          ? await removeClientAccess(clientId)
          : confirm === "archive"
            ? await setClientArchived(clientId, !archived)
            : await deleteClient(clientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirm(null);
      if (confirm === "delete") {
        toast.success("Cliente eliminado");
        router.push("/clientes");
      } else if (confirm === "access") {
        toast.success(appAccess === "pending" ? "Invitación cancelada" : "Acceso a la app quitado");
      } else {
        toast.success(archived ? "Cliente reactivado" : "Cliente archivado");
      }
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      {!archived && appAccess === "none" ? (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInviting(true)}>
          <Smartphone className="size-4" /> Invitar a la app
        </Button>
      ) : null}
      {appAccess !== "none" ? (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirm("access")}>
          <UserX className="size-4" /> {appAccess === "pending" ? "Cancelar invitación" : "Quitar acceso"}
        </Button>
      ) : null}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirm("archive")}>
        {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        {archived ? "Reactivar" : "Archivar"}
      </Button>
      <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setConfirm("delete")}>
        <Trash2 className="size-4" /> Eliminar
      </Button>

      {inviting ? (
        <InviteDialog
          clientId={clientId}
          name={name}
          defaultEmail={email}
          open={inviting}
          onOpenChange={setInviting}
        />
      ) : null}

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          {confirm ? (
            <>
              <DialogHeader>
                <DialogTitle>{dialogs[confirm].title}</DialogTitle>
                <DialogDescription>{dialogs[confirm].text}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)} disabled={pending}>
                  Volver
                </Button>
                <Button
                  variant={confirm === "archive" && archived ? "default" : "destructive"}
                  onClick={run}
                  disabled={pending}
                >
                  {pending ? "…" : dialogs[confirm].cta}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
