import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { SettingsHeader } from "@/components/settings/settings-header";
import { requireProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2.5 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/** Ajustes → Mi perfil: datos personales editables + cuenta (email y rol fijos). */
export default async function PerfilPage() {
  const { profile, email } = await requireProfile();

  return (
    <div className="space-y-6">
      <SettingsHeader title="Mi perfil" />

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
          <Row
            label="Usuario"
            value={profile.username ? `@${profile.username}` : "—"}
          />
          <Row label="Rol" value={profile.is_coach ? "Coach" : "Alumno"} />
          <p className="text-muted-foreground pt-3 text-xs">
            El email y el rol no se pueden modificar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
