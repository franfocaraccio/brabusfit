import Link from "next/link";
import { notFound } from "next/navigation";

import { formatSessionDate, summarizeHistory } from "@brabus/shared";
import { getSessionDetail } from "@brabus/supabase";

import { SessionEditor } from "@/components/history/session-editor";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SesionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { userId } = await requireProfile();

  const session = await getSessionDetail(await createClient(), sessionId);
  if (!session) notFound();

  // Solo quien entrenó edita; el coach (dueño de la rutina) la ve en solo lectura.
  const isOwner = session.userId === userId;
  const back = isOwner
    ? { href: `/rutinas/${session.routineId}/historial`, label: "Historial" }
    : { href: `/alumnos/${session.userId}`, label: "Alumno" };

  return (
    <div className="space-y-6">
      <div>
        <Link href={back.href} className="text-muted-foreground hover:text-foreground text-sm">
          ← {back.label}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{session.dayName}</h1>
        <p className="text-muted-foreground text-sm">
          {session.routineName} · {formatSessionDate(session.date)}
        </p>
      </div>

      {isOwner ? (
        <SessionEditor session={session} />
      ) : (
        <div className="space-y-3">
          {session.logs.map((l) => (
            <Card key={l.id} className="gap-1 p-4">
              <p className="font-semibold">{l.exerciseName}</p>
              <p className="text-muted-foreground text-sm">
                {summarizeHistory({ sets: l.sets, note: l.note }) || "Sin series"}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
