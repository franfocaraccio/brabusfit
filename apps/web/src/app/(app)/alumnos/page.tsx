import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";

import { formatDate } from "@brabus/shared";
import { getStudents } from "@brabus/supabase";

import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AlumnosPage() {
  const { profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  const students = await getStudents(await createClient());

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
