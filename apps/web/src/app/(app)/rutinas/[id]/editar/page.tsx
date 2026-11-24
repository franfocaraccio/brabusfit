import { notFound } from "next/navigation";

import { routineDaysToDrafts } from "@brabus/shared";
import { getCatalog, getFolders, getRoutineForEdit } from "@brabus/supabase";

import {
  RoutineBuilder,
  type RoutineBuilderInitial,
} from "@/components/routines/routine-builder";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function EditarRutinaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, profile } = await requireProfile();
  const supabase = await createClient();

  const [routine, folders, catalog] = await Promise.all([
    getRoutineForEdit(supabase, id, userId),
    getFolders(supabase, userId),
    getCatalog(supabase, userId),
  ]);

  // Solo el dueño puede editar.
  if (!routine) notFound();

  const initial: RoutineBuilderInitial = {
    id: routine.id,
    name: routine.name,
    folderId: routine.folderId,
    clientName: routine.clientName,
    days: routineDaysToDrafts(routine.days),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Editar rutina</h1>
      <RoutineBuilder
        folders={folders}
        catalog={catalog}
        isCoach={profile.is_coach}
        initial={initial}
      />
    </div>
  );
}
