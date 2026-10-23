import Link from "next/link";
import { ChevronRight, MailOpen } from "lucide-react";

import { getCoachHome, getMyCoaches, getStudentHome } from "@brabus/supabase";

import { CoachHome } from "@/components/app/coach-home";
import { StudentHome } from "@/components/app/student-home";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { userId, profile } = await requireProfile();
  const supabase = await createClient();
  const pendingInvitations = profile.is_coach
    ? 0
    : (await getMyCoaches(supabase, userId)).filter((c) => c.status === "pending").length;

  const invitationsBanner = pendingInvitations > 0 && (
    <Link
      href="/ajustes/coaches"
      className="border-primary/40 bg-primary/10 hover:bg-primary/15 flex items-center gap-3 rounded-xl border p-4 transition-colors"
    >
      <MailOpen className="text-primary-text size-5 shrink-0" />
      <span className="flex-1 text-sm font-medium">
        {pendingInvitations === 1
          ? "Tenés 1 invitación pendiente de un coach"
          : `Tenés ${pendingInvitations} invitaciones pendientes de coaches`}
      </span>
      <ChevronRight className="text-muted-foreground size-4" />
    </Link>
  );

  // Alumno: métricas de la semana, consistencia, su rutina y su plan.
  if (!profile.is_coach) {
    const home = await getStudentHome(supabase, userId);
    return (
      <div className="space-y-4">
        {invitationsBanner}
        <StudentHome
          firstName={profile.first_name}
          finishedAt={home.finishedAt}
          routine={home.routine}
          plan={home.plan}
        />
      </div>
    );
  }

  return <CoachHome firstName={profile.first_name} data={await getCoachHome(supabase, userId)} />;
}
