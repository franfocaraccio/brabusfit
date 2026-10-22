import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { STUDENTS_CAN_EDIT_PLANS } from "@brabus/shared";
import { getClients, getPlanDetail, planExport } from "@brabus/supabase";

import { ExportButtons } from "@/components/app/export-buttons";
import { AccessBadge } from "@/components/clients/clients-list";
import { DeletePlanButton, SetCurrentPlanButton } from "@/components/nutrition/plan-actions";
import { PlanView } from "@/components/nutrition/plan-view";
import { AssignRoutine } from "@/components/routines/assign-routine";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, profile } = await requireProfile();
  const supabase = await createClient();

  const detail = await getPlanDetail(supabase, id);
  if (!detail) notFound();
  const { plan, client, ownerName } = detail;

  const isOwner = plan.owner_id === userId;
  const canEdit = isOwner && (profile.is_coach || STUDENTS_CAN_EDIT_PLANS);
  // Plantilla del coach: se asigna a un cliente creándole una copia propia.
  const canAssign = isOwner && profile.is_coach && !plan.client_id;
  const clients = canAssign ? await getClients(supabase, userId) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={client ? `/clientes/${client.id}` : "/nutricion"}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {client ? client.name : "Nutrición"}
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          {plan.name}
          {plan.is_current && (
            <span className="bg-primary/15 text-primary rounded px-1.5 text-[10px] font-semibold">
              Vigente
            </span>
          )}
        </h1>
        {!isOwner && (
          <p className="text-muted-foreground text-sm">
            De: <span className="text-foreground font-medium">{ownerName ?? "tu coach"}</span>
          </p>
        )}
        {isOwner && client && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            <span>
              Plan de:{" "}
              <Link
                href={`/clientes/${client.id}`}
                className="text-foreground font-medium hover:underline"
              >
                {client.name}
              </Link>
            </span>
            <AccessBadge status={client.status} />
          </p>
        )}
        {canAssign && (
          <p className="text-muted-foreground text-sm">
            Plantilla: asignala a un cliente para crearle su propia copia.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Link
            href={`/nutricion/${id}/editar`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Pencil className="size-4" /> Editar
          </Link>
        )}
        {canAssign && (
          <AssignRoutine
            kind="nutrition"
            routineId={id}
            clients={clients.filter((c) => !c.archived)}
          />
        )}
        {isOwner && plan.client_id && !plan.is_current && <SetCurrentPlanButton planId={id} />}
        <ExportButtons kind="plan" data={planExport(detail)} />
        {canEdit && (
          <DeletePlanButton
            planId={id}
            planName={plan.name}
            redirectTo={client ? `/clientes/${client.id}` : "/nutricion"}
          />
        )}
      </div>

      <PlanView detail={detail} />
    </div>
  );
}
