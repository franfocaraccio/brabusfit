import { redirect } from "next/navigation";

import { getMyCoaches } from "@brabus/supabase";

import { MyCoaches } from "@/components/profile/my-coaches";
import { SettingsHeader } from "@/components/settings/settings-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Ajustes → Mis coaches (solo alumnos): invitaciones y coaches vinculados. */
export default async function CoachesPage() {
  const { userId, profile } = await requireProfile();
  if (profile.is_coach) redirect("/ajustes");
  const coaches = await getMyCoaches(await createClient(), userId);

  return (
    <div className="space-y-6">
      <SettingsHeader title="Mis coaches" />
      <Card>
        <CardContent className="pt-6">
          <MyCoaches coaches={coaches} />
        </CardContent>
      </Card>
    </div>
  );
}
