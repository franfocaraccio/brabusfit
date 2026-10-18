import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { getRoutineDetail } from "@brabus/supabase";

import { LinkTile } from "@/components/app/link-tile";
import { DeleteRoutineButton } from "@/components/routines/delete-routine-button";
import { ShareRoutine, type ShareRow } from "@/components/routines/share-routine";
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
  const { routine, days } = detail;

  const isOwner = routine.owner_id === userId;
  const canShare = isOwner && profile.is_coach;

  // Panel de compartir: solo web (coach dueño).
  const sharesRes = canShare
    ? await supabase
        .from("routine_shares")
        .select(
          "id, shared_with_email, status, student:profiles!routine_shares_shared_with_user_id_fkey(first_name, last_name)",
        )
        .eq("routine_id", id)
        .order("created_at")
    : { data: [] };

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
