import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { requireProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const { profile } = await requireProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {profile.first_name} 👋
        </h1>
        <p className="text-muted-foreground text-sm">
          {profile.is_coach
            ? "Creá rutinas y compartilas con tus alumnos."
            : "Elegí una rutina y empezá a entrenar."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="size-4" /> Mis rutinas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/rutinas"
              className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
            >
              Ver rutinas
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Crear rutina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/rutinas/crear"
              className={cn(buttonVariants(), "w-full")}
            >
              Crear rutina
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
