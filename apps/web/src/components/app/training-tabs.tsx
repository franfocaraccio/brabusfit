import Link from "next/link";

import { cn } from "@/lib/utils";

const TABS = [
  { id: "rutinas", label: "Rutinas", href: "/rutinas" },
  { id: "progreso", label: "Progreso", href: "/progreso" },
] as const;

/**
 * Encabezado de la sección Entrenamiento: título + Rutinas | Progreso.
 * El coach no entrena: ve solo el título "Rutinas".
 */
export function TrainingTabs({
  active,
  action,
  isCoach = false,
}: {
  active: (typeof TABS)[number]["id"];
  isCoach?: boolean;
  /** Botón a la derecha del título (ej. "Crear rutina"). */
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {isCoach ? "Rutinas" : "Entrenamiento"}
        </h1>
        {action}
      </div>
      {isCoach ? null : (
        <div className="bg-muted inline-flex w-fit rounded-lg p-0.5">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                active === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
