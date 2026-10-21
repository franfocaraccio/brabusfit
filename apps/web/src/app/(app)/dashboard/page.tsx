import Link from "next/link";
import { ChevronRight, Dumbbell, MailOpen, Plus, Users } from "lucide-react";

import { getMyCoaches } from "@brabus/supabase";

import { LinkTile } from "@/components/app/link-tile";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { userId, profile } = await requireProfile();
  const pendingInvitations = profile.is_coach
    ? 0
    : (await getMyCoaches(await createClient(), userId)).filter((c) => c.status === "pending")
        .length;

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
            href: "/clientes",
            title: "Clientes",
            subtitle: "Fichas, rutinas y progreso de tus clientes",
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
            ? "Armales rutinas a tus clientes."
            : "Elegí una rutina y empezá a entrenar."}
        </p>
      </div>

      {pendingInvitations > 0 && (
        <Link
          href="/perfil#coaches"
          className="border-primary/40 bg-primary/10 hover:bg-primary/15 flex items-center gap-3 rounded-xl border p-4 transition-colors"
        >
          <MailOpen className="text-primary size-5 shrink-0" />
          <span className="flex-1 text-sm font-medium">
            {pendingInvitations === 1
              ? "Tenés 1 invitación pendiente de un coach"
              : `Tenés ${pendingInvitations} invitaciones pendientes de coaches`}
          </span>
          <ChevronRight className="text-muted-foreground size-4" />
        </Link>
      )}

      <div className="stagger grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
          <LinkTile key={tile.href} {...tile} />
        ))}
      </div>
    </div>
  );
}
