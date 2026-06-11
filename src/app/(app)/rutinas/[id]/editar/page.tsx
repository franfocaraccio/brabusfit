import { notFound } from "next/navigation";

import {
  RoutineBuilder,
  type RoutineBuilderInitial,
} from "@/components/routines/routine-builder";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type DayWithExercises = {
  id: string;
  name: string;
  position: number;
  exercises: { id: string; name: string; sets_reps: string; position: number }[];
};

export default async function EditarRutinaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireProfile();
  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Solo el dueño puede editar.
  if (!routine || routine.owner_id !== userId) notFound();

  const [{ data: daysData }, { data: folders }] = await Promise.all([
    supabase
      .from("routine_days")
      .select("id, name, position, exercises(id, name, sets_reps, position)")
      .eq("routine_id", id)
      .order("position"),
    supabase.from("folders").select("*").eq("owner_id", userId).order("name"),
  ]);

  const days = (daysData ?? []) as unknown as DayWithExercises[];

  const initial: RoutineBuilderInitial = {
    id: routine.id,
    name: routine.name,
    folderId: routine.folder_id,
    days: days.map((d) => ({
      key: d.id,
      id: d.id,
      name: d.name,
      exercises: [...d.exercises]
        .sort((a, b) => a.position - b.position)
        .map((e) => ({
          key: e.id,
          id: e.id,
          name: e.name,
          sets_reps: e.sets_reps,
        })),
    })),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Editar rutina</h1>
      <RoutineBuilder folders={folders ?? []} initial={initial} />
    </div>
  );
}
