import { getCatalog, getFolders } from "@brabus/supabase";

import { RoutineBuilder } from "@/components/routines/routine-builder";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CrearRutinaPage() {
  const { userId, profile } = await requireProfile();
  const supabase = await createClient();
  const [folders, catalog] = await Promise.all([
    getFolders(supabase, userId),
    getCatalog(supabase, userId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Crear rutina</h1>
      <RoutineBuilder folders={folders} catalog={catalog} isCoach={profile.is_coach} />
    </div>
  );
}
