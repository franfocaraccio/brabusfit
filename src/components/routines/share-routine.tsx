"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Share2, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { shareRoutine, unshareRoutine } from "@/lib/actions/shares";
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
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const value = email.trim();
    if (!value) return;
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

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="share-email">Email del alumno</Label>
            <Input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alumno@email.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <Button onClick={submit} disabled={pending || !email.trim()}>
            Compartir
          </Button>
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
