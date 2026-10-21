import { getCatalog, getClients, getFolders } from "@brabus/supabase";

import { RoutineBuilder } from "@/components/routines/routine-builder";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CrearRutinaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { userId, profile } = await requireProfile();
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const [folders, catalog, clients] = await Promise.all([
    getFolders(supabase, userId),
    getCatalog(supabase, userId),
    profile.is_coach ? getClients(supabase, userId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Crear rutina</h1>
      <RoutineBuilder
        folders={folders}
        catalog={catalog}
        isCoach={profile.is_coach}
        clients={clients.filter((c) => !c.archived)}
        initialClientId={cliente}
      />
    </div>
  );
}
