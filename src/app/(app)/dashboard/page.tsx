import { Dumbbell, Plus, Users } from "lucide-react";

import { LinkTile } from "@/components/app/link-tile";
import { requireProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const { profile } = await requireProfile();

  const tiles = [
    {
      href: "/rutinas/crear",
      title: "Crear rutina",
      subtitle: "Armá una rutina nueva",
      icon: Plus,
      accent: true,
    },
    {
      href: "/rutinas",
      title: "Mis rutinas",
      subtitle: "Ver y entrenar tus rutinas",
      icon: Dumbbell,
    },
    ...(profile.is_coach
      ? [
          {
            href: "/alumnos",
            title: "Alumnos",
            subtitle: "Seguí el progreso de tus alumnos",
            icon: Users,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="animate-rise">
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {profile.first_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {profile.is_coach
            ? "Creá rutinas y compartilas con tus alumnos."
            : "Elegí una rutina y empezá a entrenar."}
        </p>
      </div>

      <div className="stagger grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
          <LinkTile key={tile.href} {...tile} />
        ))}
      </div>
    </div>
  );
}
