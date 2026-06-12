import Link from "next/link";
import { Plus } from "lucide-react";

import {
  RoutinesBrowser,
  type FolderLite,
  type RoutineLite,
  type SharedLite,
} from "@/components/routines/routines-browser";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SharedRow = {
  id: string;
  routine: {
    id: string;
    name: string;
    owner: { first_name: string; last_name: string } | null;
  } | null;
};

export default async function RutinasPage() {
  const { userId, profile } = await requireProfile();
  const supabase = await createClient();

  const [foldersRes, routinesRes, sharedRes] = await Promise.all([
    supabase.from("folders").select("id, name").eq("owner_id", userId).order("name"),
    supabase
      .from("routines")
      .select("id, name, folder_id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("routine_shares")
      .select(
        "id, routine:routines(id, name, owner:profiles!routines_owner_id_fkey(first_name, last_name))",
      )
      .eq("shared_with_user_id", userId)
      .eq("status", "accepted"),
  ]);

  const folders = (foldersRes.data ?? []) as FolderLite[];
  const routines = (routinesRes.data ?? []) as RoutineLite[];
  const sharedRows = (sharedRes.data ?? []) as unknown as SharedRow[];

  const shared: SharedLite[] = sharedRows
    .filter((s) => s.routine)
    .map((s) => ({
      id: s.id,
      routineId: s.routine!.id,
      name: s.routine!.name,
      coachName: s.routine!.owner
        ? `${s.routine!.owner.first_name} ${s.routine!.owner.last_name}`.trim()
        : null,
    }));

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
