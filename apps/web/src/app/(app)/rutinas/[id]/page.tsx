import Link from "next/link";
import { notFound } from "next/navigation";
import { History, Pencil } from "lucide-react";

import { getClients, getRoutineDetail, getRoutineExport } from "@brabus/supabase";

import { LinkTile } from "@/components/app/link-tile";
import { AccessBadge } from "@/components/clients/clients-list";
import { DeleteRoutineButton } from "@/components/routines/delete-routine-button";
import { AssignRoutine } from "@/components/routines/assign-routine";
import { ExportButtons } from "@/components/app/export-buttons";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function RutinaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, profile } = await requireProfile();
  const supabase = await createClient();

  const detail = await getRoutineDetail(supabase, id);
  if (!detail) notFound();
  const { routine, ownerName, client, days } = detail;

  const isOwner = routine.owner_id === userId;
  // Plantilla del coach: se asigna a un cliente creándole una copia propia.
  const canAssign = isOwner && profile.is_coach && !routine.client_id;
  const [clients, exportData] = await Promise.all([
    canAssign ? getClients(supabase, userId) : Promise.resolve([]),
    getRoutineExport(supabase, id, detail),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={client ? `/clientes/${client.id}` : "/rutinas"}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {client ? client.name : "Rutinas"}
        </Link>
        <div className="mt-1 flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{routine.name}</h1>
        </div>
        {!isOwner && (
          <p className="text-muted-foreground text-sm">
            Compartida por:{" "}
            <span className="text-foreground font-medium">{ownerName ?? "tu coach"}</span>
          </p>
        )}
        {isOwner && client && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            <span>
              Rutina de:{" "}
              <Link
                href={`/clientes/${client.id}`}
                className="text-foreground font-medium hover:underline"
              >
                {client.name}
              </Link>
            </span>
            <AccessBadge status={client.status} />
            {client.archived ? (
              <span className="bg-muted rounded px-1.5 text-[10px] font-semibold">Archivado</span>
            ) : null}
          </p>
        )}
        {canAssign && (
          <p className="text-muted-foreground text-sm">
            Plantilla: asignala a un cliente para crearle su propia copia.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {isOwner && (
          <Link
            href={`/rutinas/${id}/editar`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Pencil className="size-4" /> Editar
          </Link>
        )}
        {canAssign && (
          <AssignRoutine routineId={id} clients={clients.filter((c) => !c.archived)} />
        )}
        {exportData && <ExportButtons kind="routine" data={exportData} />}
        <Link
          href={`/rutinas/${id}/historial`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <History className="size-4" /> Historial
        </Link>
        {isOwner && <DeleteRoutineButton routineId={id} routineName={routine.name} />}
      </div>

      <section className="space-y-2.5">
        <h2 className="text-muted-foreground text-sm font-semibold">
          {client ? "Días" : "Elegí un día para entrenar"}
        </h2>
        {days.length > 0 ? (
          <div className="stagger space-y-2.5">
            {days.map((day, i) => (
              <LinkTile
                key={day.id}
                href={`/rutinas/${id}/dia/${day.id}`}
                title={day.name}
                subtitle={`${day.exerciseCount} ejercicios`}
                chip={i + 1}
                accent
              />
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Esta rutina no tiene días.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
