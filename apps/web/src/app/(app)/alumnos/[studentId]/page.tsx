import Link from "next/link";
import { notFound } from "next/navigation";

import { formatSessionDate, summarizeHistory } from "@brabus/shared";
import { getProgressSessions, getStudentDetail, visibleLogs } from "@brabus/supabase";

import { ProgressView } from "@/components/progress/progress-view";
import { SegmentedTabs } from "@/components/progress/segmented-tabs";
import { Dumbbell } from "lucide-react";

import { LinkTile } from "@/components/app/link-tile";
import { UnlinkStudent } from "@/components/students/unlink-student";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AlumnoDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { userId, profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  const supabase = await createClient();
  const [detail, progress] = await Promise.all([
    getStudentDetail(supabase, userId, studentId),
    getProgressSessions(supabase, studentId),
  ]);
  if (!detail) notFound();
  const { name, sessions, link, routines } = detail;
  const isPending = link.status === "pending";

  const workouts =
    sessions.length === 0 ? (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Este alumno todavía no registró entrenamientos.
        </p>
      </Card>
    ) : (
      <div className="space-y-3">
        {sessions.map((s) => {
          const logs = visibleLogs(s);
          return (
            <Link key={s.id} href={`/sesiones/${s.id}`} className="block">
              <Card className="hover:ring-primary/40 space-y-3 p-4 transition">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {s.routine?.name} · {s.day?.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatSessionDate(s.finished_at ?? s.started_at)}
                  </span>
                </div>
                <div className="space-y-2">
                  {logs.map((l, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{l.exercise?.name ?? "Ejercicio"}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {summarizeHistory({
                          sets: [...l.set_logs].sort((a, b) => a.set_number - b.set_number),
                          note: l.note,
                        })}
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-muted-foreground text-xs">Sin series registradas.</p>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/alumnos" className="text-muted-foreground hover:text-foreground text-sm">
          ← Alumnos
        </Link>
        <div className="mt-1 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <p className="text-muted-foreground text-sm">
              {detail.username ? `@${detail.username} · ` : ""}
              {detail.email}
            </p>
          </div>
          <UnlinkStudent
            linkId={link.id}
            name={name}
            pending={isPending}
            routineCount={routines.length}
            redirectTo="/alumnos"
          />
        </div>
      </div>

      {isPending && (
        <Card className="border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm">
            <span className="font-semibold">Invitación pendiente.</span> Ya podés compartirle
            rutinas: las va a ver cuando acepte. Su progreso aparece después de aceptar.
          </p>
        </Card>
      )}

      <SegmentedTabs
        tabs={[
          {
            id: "progreso",
            label: "Progreso",
            content: (
              <ProgressView
                sessions={progress}
                emptyText={
                  isPending
                    ? "Vas a ver su progreso cuando acepte la invitación."
                    : "Este alumno todavía no registró entrenamientos en tus rutinas."
                }
              />
            ),
          },
          { id: "entrenamientos", label: "Entrenamientos", content: workouts },
          {
            id: "rutinas",
            label: `Rutinas (${routines.length})`,
            content:
              routines.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    Todavía no le compartiste rutinas. Entrá a una rutina y tocá
                    &quot;Compartir&quot;.
                  </p>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {routines.map((r) => (
                    <LinkTile key={r.id} href={`/rutinas/${r.id}`} title={r.name} icon={Dumbbell} />
                  ))}
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
