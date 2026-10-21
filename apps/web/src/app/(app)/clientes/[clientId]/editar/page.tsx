import Link from "next/link";
import { notFound } from "next/navigation";

import { getClient } from "@brabus/supabase";

import { ClientForm } from "@/components/clients/client-form";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { userId, profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  const detail = await getClient(await createClient(), userId, clientId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/clientes/${clientId}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {detail.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Editar ficha</h1>
      </div>
      <ClientForm
        clientId={clientId}
        initial={detail.data}
        emailLocked={detail.appAccess !== "none"}
      />
    </div>
  );
}
