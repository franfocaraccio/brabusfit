import { notFound } from "next/navigation";

import { getNutritionFolders, getPlanDetail, planToInput } from "@brabus/supabase";

import { PlanBuilder } from "@/components/nutrition/plan-builder";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function EditarPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await requireProfile();
  const supabase = await createClient();
  const [detail, folders] = await Promise.all([
    getPlanDetail(supabase, id),
    getNutritionFolders(supabase, userId),
  ]);
  // Solo el dueño edita.
  if (!detail || detail.plan.owner_id !== userId) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Editar plan</h1>
      <PlanBuilder
        planId={id}
        initial={planToInput(detail)}
        clientName={detail.plan.client_id ? (detail.client?.name ?? "Cliente") : null}
        folders={folders}
      />
    </div>
  );
}
