import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type SetLog = { set_number: number; weight: number | null; reps: number | null };
type ExLog = {
  completed: boolean;
  exercise: { name: string } | null;
  set_logs: SetLog[];
};
type SessionRow = {
  id: string;
  finished_at: string | null;
  started_at: string;
  day: { name: string } | null;
  routine: { name: string } | null;
  exercise_logs: ExLog[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function summarize(sets: SetLog[]) {
  return [...sets]
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => {
      const w = s.weight !== null ? `${s.weight}kg` : "";
      const r = s.reps !== null ? `${s.reps}` : "";
      return [w, r].filter(Boolean).join(" × ");
    })
    .filter(Boolean)
    .join("  ·  ");
}

export default async function AlumnoDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  const supabase = await createClient();

  const { data: student } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) notFound();

  const { data: sessionsData } = await supabase
    .from("workout_sessions")
    .select(
      "id, finished_at, started_at, day:routine_days(name), routine:routines(name), exercise_logs(completed, exercise:exercises(name), set_logs(set_number, weight, reps))",
    )
    .eq("user_id", studentId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(20);

  const sessions = (sessionsData ?? []) as unknown as SessionRow[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/alumnos"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Alumnos
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {student.first_name} {student.last_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Últimos entrenamientos registrados.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Este alumno todavía no registró entrenamientos.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id} className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {s.routine?.name} · {s.day?.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(s.finished_at ?? s.started_at)}
                </span>
              </div>
              <div className="space-y-1.5">
                {s.exercise_logs
                  .filter((l) => l.set_logs.length > 0)
                  .map((l, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">
                        {l.exercise?.name ?? "Ejercicio"}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {summarize(l.set_logs)}
                      </span>
                    </div>
                  ))}
                {s.exercise_logs.filter((l) => l.set_logs.length > 0).length ===
                  0 && (
                  <p className="text-muted-foreground text-xs">
                    Sin series registradas.
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
