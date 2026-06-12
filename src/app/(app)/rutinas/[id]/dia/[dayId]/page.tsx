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
  completed: boolean;
  note: string | null;
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

  // Sesión en curso (si la hay) para prellenar lo ya cargado.
  const { data: current } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("day_id", dayId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentLogs: LogRow[] = [];
  if (current) {
    const { data } = await supabase
      .from("exercise_logs")
      .select("exercise_id, completed, note, set_logs(set_number, weight, reps)")
      .eq("session_id", current.id);
    currentLogs = (data ?? []) as unknown as LogRow[];
  }

  // Últimas 3 sesiones finalizadas de este día (historial).
  const { data: finishedSessions } = await supabase
    .from("workout_sessions")
    .select(
      "id, finished_at, started_at, exercise_logs(exercise_id, completed, set_logs(set_number, weight, reps))",
    )
    .eq("user_id", userId)
    .eq("day_id", dayId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(3);

  const history = (finishedSessions ?? []) as unknown as HistorySessionRow[];

  // Mapas auxiliares.
  const currentByExercise = new Map(currentLogs.map((l) => [l.exercise_id, l]));

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

  const exerciseStates: ExerciseState[] = exercises.map((ex) => {
    const log = currentByExercise.get(ex.id);
    const sets = log
      ? [...(log.set_logs ?? [])].sort((a, b) => a.set_number - b.set_number)
      : [];
    return {
      id: ex.id,
      name: ex.name,
      setsReps: ex.sets_reps,
      completed: log?.completed ?? false,
      savedSets: sets,
      note: log?.note ?? "",
      history: historyByExercise.get(ex.id) ?? [],
    };
  });

  return (
    <DayTrainer
      routineId={routineId}
      dayId={dayId}
      dayName={day.name}
      initialSessionId={current?.id ?? null}
      exercises={exerciseStates}
    />
  );
}
