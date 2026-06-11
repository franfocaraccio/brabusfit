import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ShareRow = {
  shared_with_user_id: string | null;
  student: { first_name: string; last_name: string } | null;
  shared_with_email: string;
  routine: { id: string; name: string } | null;
};
type SessionRow = { user_id: string; finished_at: string | null };

type StudentGroup = {
  id: string;
  name: string;
  email: string;
  routines: string[];
  lastActivity: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function AlumnosPage() {
  const { profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  const supabase = await createClient();

  const [sharesRes, sessionsRes] = await Promise.all([
    supabase
      .from("routine_shares")
      .select(
        "shared_with_user_id, shared_with_email, status, student:profiles!routine_shares_shared_with_user_id_fkey(first_name, last_name), routine:routines(id, name)",
      )
      .eq("status", "accepted"),
    supabase
      .from("workout_sessions")
      .select("user_id, finished_at")
      .eq("status", "finished")
      .order("finished_at", { ascending: false }),
  ]);

  const shares = (sharesRes.data ?? []) as unknown as ShareRow[];
  const sessions = (sessionsRes.data ?? []) as SessionRow[];

  const lastByUser = new Map<string, string>();
  for (const s of sessions) {
    if (s.finished_at && !lastByUser.has(s.user_id)) {
      lastByUser.set(s.user_id, s.finished_at);
    }
  }

  const groups = new Map<string, StudentGroup>();
  for (const s of shares) {
    if (!s.shared_with_user_id) continue;
    const existing = groups.get(s.shared_with_user_id);
    const routineName = s.routine?.name;
    if (existing) {
      if (routineName) existing.routines.push(routineName);
    } else {
      groups.set(s.shared_with_user_id, {
        id: s.shared_with_user_id,
        name: s.student
          ? `${s.student.first_name} ${s.student.last_name}`.trim()
          : s.shared_with_email,
        email: s.shared_with_email,
        routines: routineName ? [routineName] : [],
        lastActivity: lastByUser.get(s.shared_with_user_id) ?? null,
      });
    }
  }

  const students = [...groups.values()];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alumnos</h1>
        <p className="text-muted-foreground text-sm">
          Seguí el progreso de tus alumnos.
        </p>
      </div>

      {students.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">
            Todavía no compartiste rutinas con ningún alumno con cuenta activa.
          </p>
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden py-0">
          {students.map((st) => (
            <Link
              key={st.id}
              href={`/alumnos/${st.id}`}
              className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3.5 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {st.name}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {st.routines.length} rutina(s) ·{" "}
                  {st.lastActivity
                    ? `última actividad ${formatDate(st.lastActivity)}`
                    : "sin entrenamientos aún"}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-4" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
