import { notFound } from "next/navigation";

import { STUDENTS_CAN_EDIT_PLANS } from "@brabus/shared";
import { getClients, getNutritionFolders } from "@brabus/supabase";

import { PlanBuilder } from "@/components/nutrition/plan-builder";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CrearPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { userId, profile } = await requireProfile();
  if (!profile.is_coach && !STUDENTS_CAN_EDIT_PLANS) notFound();
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const [folders, clients] = await Promise.all([
    getNutritionFolders(supabase, userId),
    profile.is_coach ? getClients(supabase, userId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Crear plan de nutrición</h1>
      <PlanBuilder
        folders={folders}
        clients={clients.filter((c) => !c.archived)}
        initialClientId={cliente}
      />
    </div>
  );
}
