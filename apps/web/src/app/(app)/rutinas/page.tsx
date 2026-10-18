import Link from "next/link";
import { Plus } from "lucide-react";

import { getRoutinesOverview } from "@brabus/supabase";

import { RoutinesBrowser } from "@/components/routines/routines-browser";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function RutinasPage() {
  const { userId, profile } = await requireProfile();
  const { folders, routines, shared } = await getRoutinesOverview(
    await createClient(),
    userId,
  );

  // Si no hay nada, el empty state ya ofrece "Crear mi primera rutina":
  // ocultamos el botón chico del header para no duplicar.
  const hasNothing =
    routines.length === 0 && folders.length === 0 && shared.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Rutinas</h1>
        {!hasNothing && (
          <Link
            href="/rutinas/crear"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <Plus className="size-4" /> Crear rutina
          </Link>
        )}
      </div>

      <RoutinesBrowser
        isCoach={profile.is_coach}
        folders={folders}
        routines={routines}
        shared={shared}
      />
    </div>
  );
}
