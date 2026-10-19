import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "lucide-react";

import { formatSessionDate } from "@brabus/shared";
import { getRoutineDetail, getRoutineSessions } from "@brabus/supabase";

import { LinkTile } from "@/components/app/link-tile";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function HistorialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireProfile();
  const supabase = await createClient();

  const [detail, sessions] = await Promise.all([
    getRoutineDetail(supabase, id),
    getRoutineSessions(supabase, { routineId: id, userId }),
  ]);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/rutinas/${id}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {detail.routine.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Historial</h1>
        <p className="text-muted-foreground text-sm">
          Tus entrenamientos guardados de esta rutina. Tocá uno para verlo o corregirlo.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card className="p-8 text-center">
          <History className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">
            Todavía no guardaste entrenamientos de esta rutina.
          </p>
        </Card>
      ) : (
        <div className="stagger space-y-2.5">
          {sessions.map((s) => (
            <LinkTile
              key={s.id}
              href={`/sesiones/${s.id}`}
              title={s.dayName}
              subtitle={`${formatSessionDate(s.date)} · ${s.exerciseCount} ${
                s.exerciseCount === 1 ? "ejercicio" : "ejercicios"
              }`}
              icon={History}
            />
          ))}
        </div>
      )}
    </div>
  );
}
