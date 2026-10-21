import { getCatalog, getFolders, getStudents } from "@brabus/supabase";

import { RoutineBuilder } from "@/components/routines/routine-builder";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CrearRutinaPage({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string }>;
}) {
  const { userId, profile } = await requireProfile();
  const { alumno } = await searchParams;
  const supabase = await createClient();
  const [folders, catalog, students] = await Promise.all([
    getFolders(supabase, userId),
    getCatalog(supabase, userId),
    profile.is_coach ? getStudents(supabase, userId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Crear rutina</h1>
      <RoutineBuilder
        folders={folders}
        catalog={catalog}
        isCoach={profile.is_coach}
        students={students}
        initialStudentLinkId={alumno}
      />
    </div>
  );
}
