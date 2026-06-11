import { RoutineBuilder } from "@/components/routines/routine-builder";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CrearRutinaPage() {
  const { userId } = await requireProfile();
  const supabase = await createClient();

  const { data: folders } = await supabase
    .from("folders")
    .select("*")
    .eq("owner_id", userId)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Crear rutina</h1>
      <RoutineBuilder folders={folders ?? []} />
    </div>
  );
}
