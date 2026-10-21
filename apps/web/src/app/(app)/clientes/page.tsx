import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";

import { getClients } from "@brabus/supabase";

import { ClientsList } from "@/components/clients/clients-list";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function ClientesPage() {
  const { userId, profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  const clients = await getClients(await createClient(), userId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            La ficha de cada cliente, sus rutinas y su progreso (si usa la app).
          </p>
        </div>
        <Link href="/clientes/nuevo" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
          <UserPlus className="size-4" /> Nuevo cliente
        </Link>
      </div>

      <ClientsList clients={clients} />
    </div>
  );
}
