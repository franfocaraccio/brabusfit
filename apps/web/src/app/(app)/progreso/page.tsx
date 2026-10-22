import { redirect } from "next/navigation";

import { getProgressSessions } from "@brabus/supabase";

import { TrainingTabs } from "@/components/app/training-tabs";
import { ProgressView } from "@/components/progress/progress-view";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProgresoPage() {
  const { userId, profile } = await requireProfile();
  // El coach no entrena: no tiene progreso propio.
  if (profile.is_coach) redirect("/rutinas");
  const sessions = await getProgressSessions(await createClient(), userId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <TrainingTabs active="progreso" />
        <p className="text-muted-foreground text-sm">
          Tu evolución por ejercicio, en todas tus rutinas.
        </p>
      </div>
      <ProgressView sessions={sessions} />
    </div>
  );
}
