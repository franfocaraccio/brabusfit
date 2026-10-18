import { notFound } from "next/navigation";

import { getTrainingDay } from "@brabus/supabase";

import { DayTrainer } from "@/components/training/day-trainer";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function TrainDayPage({
  params,
}: {
  params: Promise<{ id: string; dayId: string }>;
}) {
  const { id: routineId, dayId } = await params;
  const { userId } = await requireProfile();

  // Cada entrenamiento arranca de cero (precargado con la última sesión).
  const data = await getTrainingDay(await createClient(), {
    userId,
    routineId,
    dayId,
  });
  if (!data) notFound();

  return (
    <DayTrainer
      routineId={routineId}
      dayId={dayId}
      dayName={data.day.name}
      exercises={data.exercises}
    />
  );
}
