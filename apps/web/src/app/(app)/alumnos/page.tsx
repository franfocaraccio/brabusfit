import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";

import { formatDate } from "@brabus/shared";
import { getStudents, type StudentSummary } from "@brabus/supabase";

import { AddStudent } from "@/components/students/add-student";
import { UnlinkStudent } from "@/components/students/unlink-student";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function subtitle(st: StudentSummary) {
  const routines = `${st.routineCount} ${st.routineCount === 1 ? "rutina" : "rutinas"}`;
  if (st.status === "pending") return `Invitación pendiente · ${routines}`;
  return `${routines} · ${
    st.lastActivity ? `última actividad ${formatDate(st.lastActivity)}` : "sin entrenamientos aún"
  }`;
}

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ agregar?: string }>;
}) {
  const { userId, profile } = await requireProfile();
  if (!profile.is_coach) notFound();
  const { agregar } = await searchParams;

  const students = await getStudents(await createClient(), userId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alumnos</h1>
          <p className="text-muted-foreground text-sm">
            Tu grupo: seguí su progreso y compartiles lo que armes.
          </p>
        </div>
        <AddStudent defaultOpen={agregar === "1"} />
      </div>

      {students.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">
            Todavía no tenés alumnos. Agregalos por su usuario o email.
          </p>
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden py-0">
          {students.map((st) =>
            st.studentId ? (
              <Link
                key={st.linkId}
                href={`/alumnos/${st.studentId}`}
                className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3.5 transition-colors"
              >
                <StudentRow st={st} />
                <ChevronRight className="text-muted-foreground size-4" />
              </Link>
            ) : (
              // Invitación a un email sin cuenta: no hay detalle todavía.
              <div key={st.linkId} className="flex items-center gap-3 px-4 py-3">
                <StudentRow st={st} />
                <UnlinkStudent
                  linkId={st.linkId}
                  name={st.email}
                  pending
                  routineCount={st.routineCount}
                />
              </div>
            ),
          )}
        </Card>
      )}
    </div>
  );
}

function StudentRow({ st }: { st: StudentSummary }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold">{st.name}</span>
        {st.status === "pending" ? (
          <span className="rounded bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-500">
            Pendiente
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground block truncate text-xs">
        {st.username ? `@${st.username} · ` : ""}
        {subtitle(st)}
      </span>
    </span>
  );
}
