"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Dumbbell, FilePlus2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { APP_ACCESS_LABEL } from "@brabus/shared";

import type { ClientSummary, FolderLite, RoutineLite } from "@brabus/supabase";

import { copyRoutine } from "@/lib/actions/routines";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Copia la rutina y abre la copia nueva. */
function useCopy() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const run = (key: string, routineId: string, linkId: string, success: string) => {
    setBusy(key);
    startTransition(async () => {
      const result = await copyRoutine(routineId, linkId);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.push(`/rutinas/${result.data.id}`);
    });
  };
  return { pending, busy, run };
}

/** Desde una plantilla: elegir el cliente al que se le crea una copia. */
export function AssignRoutine({
  routineId,
  clients,
}: {
  routineId: string;
  /** Clientes activos (no archivados). */
  clients: ClientSummary[];
}) {
  const { pending, busy, run } = useCopy();

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <UserPlus className="size-4" /> Asignar a cliente
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar a un cliente</DialogTitle>
          <DialogDescription>
            Se le crea una copia propia de esta plantilla. Después podés ajustarla solo para ese
            cliente: los cambios no afectan a la plantilla ni a otros clientes.
          </DialogDescription>
        </DialogHeader>

        {clients.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no tenés clientes.</p>
        ) : (
          <div className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
            {clients.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => run(st.id, routineId, st.id, `Rutina asignada a ${st.name}`)}
                disabled={pending}
                className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{st.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {APP_ACCESS_LABEL[st.appAccess]}
                    {` · ${st.routineCount} ${st.routineCount === 1 ? "rutina" : "rutinas"}`}
                  </span>
                </span>
                {busy === st.id ? (
                  <span className="text-muted-foreground text-xs">Creando…</span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        <Link
          href="/clientes/nuevo"
          className={cn(buttonVariants({ variant: "outline" }), "w-full gap-1.5")}
        >
          <UserPlus className="size-4" /> Nuevo cliente
        </Link>
      </DialogContent>
    </Dialog>
  );
}

/** Desde el cliente: rutina nueva desde cero o copiando una plantilla. */
export function NewClientRoutine({
  clientId,
  clientName,
  folders,
  templates,
}: {
  clientId: string;
  clientName: string;
  folders: FolderLite[];
  templates: RoutineLite[];
}) {
  const { pending, busy, run } = useCopy();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const groups = [
    ...folders.map((f) => ({
      id: f.id,
      name: f.name,
      items: templates.filter((t) => t.folder_id === f.id),
    })),
    { id: "__root__", name: "Sin carpeta", items: templates.filter((t) => !t.folder_id) },
  ]
    .map((g) => ({
      ...g,
      items:
        !q || g.name.toLowerCase().includes(q)
          ? g.items
          : g.items.filter((t) => t.name.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Dialog onOpenChange={(open) => open && setQuery("")}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <FilePlus2 className="size-4" /> Nueva rutina
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva rutina para {clientName}</DialogTitle>
          <DialogDescription>
            Armala desde cero o partí de una de tus plantillas (se crea una copia propia del
            cliente).
          </DialogDescription>
        </DialogHeader>

        <Link
          href={`/rutinas/crear?cliente=${clientId}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-full gap-1.5")}
        >
          <FilePlus2 className="size-4" /> Desde cero
        </Link>

        {templates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Todavía no tenés plantillas. Las plantillas se crean desde Rutinas.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Desde una plantilla</p>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar plantilla o carpeta…"
                className="pl-9"
              />
            </div>
            <div className="max-h-[45vh] space-y-3 overflow-y-auto">
              {groups.length === 0 ? (
                <p className="text-muted-foreground px-1 text-sm">No se encontraron resultados.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.id} className="space-y-1">
                    <p className="text-muted-foreground px-1 text-xs">{g.name}</p>
                    <div className="divide-y rounded-lg border">
                      {g.items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            run(t.id, t.id, clientId, `Rutina creada para ${clientName}`)
                          }
                          disabled={pending}
                          className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-60"
                        >
                          <Dumbbell className="text-muted-foreground size-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {t.name}
                          </span>
                          {busy === t.id ? (
                            <span className="text-muted-foreground text-xs">Creando…</span>
                          ) : (
                            <Copy className="text-muted-foreground size-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
