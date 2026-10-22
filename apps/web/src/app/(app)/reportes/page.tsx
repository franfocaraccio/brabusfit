import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

/** Reportes (check-in): todavía no está disponible. */
export default async function ReportesPage() {
  const { profile } = await requireProfile();
  if (profile.is_coach) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <ClipboardList className="text-primary size-8" />
        <p className="font-semibold">Próximamente</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Acá vas a poder cargar tu peso, medidas y fotos, y ver tu evolución.
        </p>
      </Card>
    </div>
  );
}
