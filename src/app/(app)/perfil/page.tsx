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

export default async function PerfilPage() {
  const { profile, email } = await requireProfile();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Row label="Nombre" value={profile.first_name} />
          <Row label="Apellido" value={profile.last_name} />
          <Row label="Email" value={email} />
          <Row
            label="Fecha de nacimiento"
            value={profile.birth_date ?? "—"}
          />
          <Row
            label="Altura"
            value={profile.height_cm ? `${profile.height_cm} cm` : "—"}
          />
          <Row
            label="Peso"
            value={profile.weight_kg ? `${profile.weight_kg} kg` : "—"}
          />
          <Row label="Rol" value={profile.is_coach ? "Coach" : "Alumno"} />
        </CardContent>
      </Card>
    </div>
  );
}
