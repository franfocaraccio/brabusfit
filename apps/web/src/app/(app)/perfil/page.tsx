import { getMyCoaches } from "@brabus/supabase";

import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { MyCoaches } from "@/components/profile/my-coaches";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2.5 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default async function PerfilPage() {
  const { userId, profile, email } = await requireProfile();
  const coaches = profile.is_coach ? [] : await getMyCoaches(await createClient(), userId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>

      {!profile.is_coach && (
        <Card id="coaches">
          <CardHeader>
            <CardTitle className="text-base">Mis coaches</CardTitle>
          </CardHeader>
          <CardContent>
            <MyCoaches coaches={coaches} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent>
          <EditProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Row label="Email" value={email} />
          <Row label="Rol" value={profile.is_coach ? "Coach" : "Alumno"} />
          <p className="text-muted-foreground pt-3 text-xs">
            El email y el rol no se pueden modificar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
