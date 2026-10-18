import { notFound } from "next/navigation";

import { DayTrainer } from "@/components/training/day-trainer";
import type {
  ExerciseState,
  HistoryEntry,
} from "@/components/training/day-trainer";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ExerciseRow = { id: string; name: string; sets_reps: string; position: number };
type SetLogRow = { set_number: number; weight: number | null; reps: number | null };
type LogRow = {
  exercise_id: string;
  set_logs: SetLogRow[];
};
type HistorySessionRow = {
  id: string;
  finished_at: string | null;
  started_at: string;
  exercise_logs: LogRow[];
};

export default async function TrainDayPage({
  params,
}: {
  params: Promise<{ id: string; dayId: string }>;
}) {
  const { id: routineId, dayId } = await params;
  const { userId } = await requireProfile();
  const supabase = await createClient();

  const { data: day } = await supabase
    .from("routine_days")
    .select("id, name, routine_id")
    .eq("id", dayId)
    .maybeSingle();

  if (!day || day.routine_id !== routineId) notFound();

  const { data: exercisesData } = await supabase
    .from("exercises")
    .select("id, name, sets_reps, position")
    .eq("day_id", dayId)
    .order("position");

  const exercises = (exercisesData ?? []) as ExerciseRow[];

  // Cada entrenamiento arranca de cero: nada se persiste hasta cerrar la
  // rutina. Solo cargamos las últimas 3 sesiones finalizadas como historial.
  const { data: finishedSessions } = await supabase
    .from("workout_sessions")
    .select(
      "id, finished_at, started_at, exercise_logs(exercise_id, set_logs(set_number, weight, reps))",
    )
    .eq("user_id", userId)
    .eq("day_id", dayId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(3);

  const history = (finishedSessions ?? []) as unknown as HistorySessionRow[];

  const historyByExercise = new Map<string, HistoryEntry[]>();
  for (const session of history) {
    const date = session.finished_at ?? session.started_at;
    for (const log of session.exercise_logs ?? []) {
      const sets = [...(log.set_logs ?? [])].sort(
        (a, b) => a.set_number - b.set_number,
      );
      if (sets.length === 0) continue;
      const list = historyByExercise.get(log.exercise_id) ?? [];
      list.push({ date, sets });
      historyByExercise.set(log.exercise_id, list);
    }
  }

  const exerciseStates: ExerciseState[] = exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    setsReps: ex.sets_reps,
    history: historyByExercise.get(ex.id) ?? [],
  }));

  return (
    <DayTrainer
      routineId={routineId}
      dayId={dayId}
      dayName={day.name}
      exercises={exerciseStates}
    />
  );
}
