import Link from "next/link";
import { notFound } from "next/navigation";
import { History, Pencil } from "lucide-react";

import { getRoutineDetail, getStudents } from "@brabus/supabase";

import { LinkTile } from "@/components/app/link-tile";
import { DeleteRoutineButton } from "@/components/routines/delete-routine-button";
import { AssignRoutine } from "@/components/routines/assign-routine";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function RutinaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, profile } = await requireProfile();
  const supabase = await createClient();

  const detail = await getRoutineDetail(supabase, id);
  if (!detail) notFound();
  const { routine, ownerName, student, days } = detail;

  const isOwner = routine.owner_id === userId;
  // Plantilla del coach: se asigna a un alumno creándole una copia propia.
  const canAssign = isOwner && profile.is_coach && !student;
  const students = canAssign ? await getStudents(supabase, userId) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/rutinas"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Rutinas
        </Link>
        <div className="mt-1 flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{routine.name}</h1>
        </div>
        {!isOwner && (
          <p className="text-muted-foreground text-sm">
            Compartida por:{" "}
            <span className="text-foreground font-medium">{ownerName ?? "tu coach"}</span>
          </p>
        )}
        {isOwner && student && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            <span>
              Rutina de:{" "}
              {student.id && student.linkStatus ? (
                <Link
                  href={`/alumnos/${student.id}`}
                  className="text-foreground font-medium hover:underline"
                >
                  {student.name}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{student.name}</span>
              )}
            </span>
            {student.linkStatus === "pending" ? (
              <span className="rounded bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-500">
                Invitación pendiente
              </span>
            ) : student.linkStatus === null ? (
              <span className="bg-muted rounded px-1.5 text-[10px] font-semibold">
                Desvinculado
              </span>
            ) : null}
          </p>
        )}
        {canAssign && (
          <p className="text-muted-foreground text-sm">
            Plantilla: asignala a un alumno para crearle su propia copia.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {isOwner && (
          <Link
            href={`/rutinas/${id}/editar`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Pencil className="size-4" /> Editar
          </Link>
        )}
        {canAssign && <AssignRoutine routineId={id} students={students} />}
        <Link
          href={`/rutinas/${id}/historial`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <History className="size-4" /> Historial
        </Link>
        {isOwner && <DeleteRoutineButton routineId={id} routineName={routine.name} />}
      </div>

      <section className="space-y-2.5">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Elegí un día para entrenar
        </h2>
        {days.length > 0 ? (
          <div className="stagger space-y-2.5">
            {days.map((day, i) => (
              <LinkTile
                key={day.id}
                href={`/rutinas/${id}/dia/${day.id}`}
                title={day.name}
                subtitle={`${day.exerciseCount} ejercicios`}
                chip={i + 1}
                accent
              />
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Esta rutina no tiene días.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
