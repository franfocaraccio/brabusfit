import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientForm } from "@/components/clients/client-form";
import { requireProfile } from "@/lib/auth";

export default async function NuevoClientePage() {
  const { profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clientes" className="text-muted-foreground hover:text-foreground text-sm">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Nuevo cliente</h1>
        <p className="text-muted-foreground text-sm">
          Solo el nombre es obligatorio. Después, si querés, lo invitás a usar la app.
        </p>
      </div>
      <ClientForm />
    </div>
  );
}
