import { getProgressSessions } from "@brabus/supabase";

import { TrainingTabs } from "@/components/app/training-tabs";
import { ProgressView } from "@/components/progress/progress-view";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProgresoPage() {
  const { userId } = await requireProfile();
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
