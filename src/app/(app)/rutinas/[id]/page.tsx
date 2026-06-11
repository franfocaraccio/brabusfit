import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil } from "lucide-react";

import { DeleteRoutineButton } from "@/components/routines/delete-routine-button";
import { ShareRoutine, type ShareRow } from "@/components/routines/share-routine";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type DayRow = {
  id: string;
  name: string;
  position: number;
  exercises: { count: number }[];
};

export default async function RutinaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, profile } = await requireProfile();
  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!routine) notFound();

  const isOwner = routine.owner_id === userId;
  const canShare = isOwner && profile.is_coach;

  const [{ data: daysData }, sharesRes] = await Promise.all([
    supabase
      .from("routine_days")
      .select("id, name, position, exercises(count)")
      .eq("routine_id", id)
      .order("position"),
    canShare
      ? supabase
          .from("routine_shares")
          .select(
            "id, shared_with_email, status, student:profiles!routine_shares_shared_with_user_id_fkey(first_name, last_name)",
          )
          .eq("routine_id", id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

  const days = (daysData ?? []) as unknown as DayRow[];
  const shares = (sharesRes.data ?? []) as unknown as ShareRow[];

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
            Rutina compartida por tu coach.
          </p>
        )}
      </div>

      {isOwner && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/rutinas/${id}/editar`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Pencil className="size-4" /> Editar
          </Link>
          {canShare && <ShareRoutine routineId={id} shares={shares} />}
          <DeleteRoutineButton routineId={id} routineName={routine.name} />
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Elegí un día para entrenar
        </h2>
        <Card className="divide-y overflow-hidden py-0">
          {days.map((day) => (
            <Link
              key={day.id}
              href={`/rutinas/${id}/dia/${day.id}`}
              className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3.5 transition-colors"
            >
              <span className="flex-1">
                <span className="block text-sm font-medium">{day.name}</span>
                <span className="text-muted-foreground text-xs">
                  {day.exercises[0]?.count ?? 0} ejercicios
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-4" />
            </Link>
          ))}
          {days.length === 0 && (
            <p className="text-muted-foreground px-4 py-3 text-sm">
              Esta rutina no tiene días.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
