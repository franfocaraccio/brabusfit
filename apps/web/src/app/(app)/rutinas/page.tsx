import Link from "next/link";
import { Plus } from "lucide-react";

import { getRoutinesOverview } from "@brabus/supabase";

import { TrainingTabs } from "@/components/app/training-tabs";
import { RoutinesBrowser } from "@/components/routines/routines-browser";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function RutinasPage() {
  const { userId, profile } = await requireProfile();
  const { folders, routines, clients, fromCoaches } = await getRoutinesOverview(
    await createClient(),
    userId,
  );

  // Si no hay nada, el empty state ya ofrece "Crear mi primera rutina":
  // ocultamos el botón chico del header para no duplicar.
  const hasNothing =
    routines.length === 0 &&
    folders.length === 0 &&
    clients.length === 0 &&
    fromCoaches.length === 0;

  return (
    <div className="space-y-6">
      <TrainingTabs
        active="rutinas"
        isCoach={profile.is_coach}
        action={
          !hasNothing && (
            <Link
              href="/rutinas/crear"
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              <Plus className="size-4" /> Crear rutina
            </Link>
          )
        }
      />

      <RoutinesBrowser
        isCoach={profile.is_coach}
        folders={folders}
        routines={routines}
        clients={clients.map((c) => ({ ...c, items: c.routines }))}
        fromCoaches={fromCoaches}
      />
    </div>
  );
}
