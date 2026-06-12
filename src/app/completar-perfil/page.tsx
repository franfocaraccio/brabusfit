import { redirect } from "next/navigation";

import { Logo } from "@/components/app/logo";
import { CompleteProfileForm } from "@/components/profile/complete-profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export default async function CompletarPerfilPage() {
  const { profile } = await requireProfile({ skipOnboarding: true });

  // Si ya completó, no tiene sentido estar acá.
  if (profile.onboarded) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo className="text-3xl" />
          <h1 className="mt-4 text-xl font-bold tracking-tight">
            Completá tu perfil
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Necesitamos un par de datos más para terminar de configurar tu
            cuenta.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <CompleteProfileForm profile={profile} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
