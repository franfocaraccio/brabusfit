import Link from "next/link";
import { ChevronRight, LogOut, Palette, User, Users } from "lucide-react";

import { getMyCoaches } from "@brabus/supabase";

import { signOutAction } from "@/lib/actions/auth";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const rowClass = "flex w-full items-center gap-3 px-4 py-3.5 text-left";

/** Ajustes: menú con todo lo de la cuenta (perfil, coaches, apariencia, salir). */
export default async function AjustesPage() {
  const { userId, profile, email } = await requireProfile();
  const pending = profile.is_coach
    ? 0
    : (await getMyCoaches(await createClient(), userId)).filter(
        (c) => c.status === "pending",
      ).length;
  const initials =
    `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>

      <Link href="/ajustes/perfil" className="block">
        <Card className="hover:bg-muted/40 flex flex-row items-center gap-4 p-4 transition-colors">
          <span className="bg-primary/15 text-primary-text flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-muted-foreground truncate text-sm">
              {profile.username ? `@${profile.username} · ` : ""}
              {email}
            </p>
          </div>
          <ChevronRight className="text-muted-foreground size-4" />
        </Card>
      </Link>

      <Card className="divide-border gap-0 divide-y py-0">
        <Link
          href="/ajustes/perfil"
          className={cn(rowClass, "hover:bg-muted/40")}
        >
          <User className="text-primary-text size-5" />
          <span className="flex-1 text-sm font-medium">Mi perfil</span>
          <ChevronRight className="text-muted-foreground size-4" />
        </Link>
        {!profile.is_coach && (
          <Link
            href="/ajustes/coaches"
            className={cn(rowClass, "hover:bg-muted/40")}
          >
            <Users className="text-primary-text size-5" />
            <span className="flex-1 text-sm font-medium">Mis coaches</span>
            {pending > 0 && (
              <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[11px] font-bold">
                {pending}
              </span>
            )}
            <ChevronRight className="text-muted-foreground size-4" />
          </Link>
        )}
        <Link
          href="/ajustes/apariencia"
          className={cn(rowClass, "hover:bg-muted/40")}
        >
          <Palette className="text-primary-text size-5" />
          <span className="flex-1 text-sm font-medium">Apariencia</span>
          <ChevronRight className="text-muted-foreground size-4" />
        </Link>
      </Card>

      <Card className="py-0">
        <form action={signOutAction}>
          <button
            type="submit"
            className={cn(rowClass, "text-destructive hover:bg-muted/40")}
          >
            <LogOut className="size-5" />
            <span className="flex-1 text-sm font-medium">Cerrar sesión</span>
          </button>
        </form>
      </Card>
    </div>
  );
}
