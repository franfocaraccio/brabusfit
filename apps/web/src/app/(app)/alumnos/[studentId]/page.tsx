import Link from "next/link";
import { notFound } from "next/navigation";

import { formatSessionDate, summarizeSets } from "@brabus/shared";
import { getStudentDetail, visibleLogs } from "@brabus/supabase";

import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AlumnoDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  const detail = await getStudentDetail(await createClient(), studentId);
  if (!detail) notFound();
  const { name, sessions } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/alumnos"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Alumnos
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{name}</h1>
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
          {sessions.map((s) => {
            const logs = visibleLogs(s);
            return (
              <Card key={s.id} className="space-y-3 p-4">
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
                      <span className="font-medium">
                        {l.exercise?.name ?? "Ejercicio"}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {summarizeSets(
                          [...l.set_logs].sort((a, b) => a.set_number - b.set_number),
                        )}
                      </span>
                      {l.note ? (
                        <p className="text-muted-foreground mt-0.5 text-xs italic">
                          “{l.note}”
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      Sin series registradas.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
