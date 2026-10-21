import Link from "next/link";
import { Plus } from "lucide-react";

import { STUDENTS_CAN_EDIT_PLANS } from "@brabus/shared";
import { getNutritionOverview } from "@brabus/supabase";

import { RoutinesBrowser } from "@/components/routines/routines-browser";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function NutricionPage() {
  const { userId, profile } = await requireProfile();
  const { folders, plans, clients, fromCoaches } = await getNutritionOverview(
    await createClient(),
    userId,
  );
  const canCreate = profile.is_coach || STUDENTS_CAN_EDIT_PLANS;
  const hasNothing =
    plans.length === 0 && folders.length === 0 && clients.length === 0 && fromCoaches.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Nutrición</h1>
        {canCreate && !hasNothing && (
          <Link href="/nutricion/crear" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            <Plus className="size-4" /> Crear plan
          </Link>
        )}
      </div>

      <RoutinesBrowser
        kind="nutrition"
        isCoach={profile.is_coach}
        folders={folders}
        routines={plans}
        clients={clients.map((c) => ({ ...c, items: c.plans }))}
        fromCoaches={fromCoaches}
      />
    </div>
  );
}
