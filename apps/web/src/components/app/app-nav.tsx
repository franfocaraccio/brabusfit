"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Dumbbell,
  Home,
  Salad,
  Settings,
  Users,
} from "lucide-react";

import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Otras rutas que también marcan este ítem como activo. */
  also?: string[];
};

export function AppNav({
  isCoach,
  pendingInvitations = 0,
}: {
  isCoach: boolean;
  /** Invitaciones de coaches sin responder: globito en "Ajustes". */
  pendingInvitations?: number;
}) {
  const pathname = usePathname();

  // El coach solo administra a sus clientes (no entrena): "Rutinas" sin Progreso.
  const items: NavItem[] = isCoach
    ? [
        { href: "/dashboard", label: "Inicio", icon: Home },
        { href: "/clientes", label: "Clientes", icon: Users },
        { href: "/rutinas", label: "Rutinas", icon: Dumbbell },
        { href: "/nutricion", label: "Nutrición", icon: Salad },
        { href: "/ajustes", label: "Ajustes", icon: Settings },
      ]
    : [
        { href: "/dashboard", label: "Inicio", icon: Home },
        // Entrenamiento agrupa Rutinas y Progreso.
        {
          href: "/rutinas",
          label: "Entrenamiento",
          icon: Dumbbell,
          also: ["/progreso"],
        },
        { href: "/nutricion", label: "Nutrición", icon: Salad },
        // Reportes (check-in): todavía en "Próximamente".
        { href: "/reportes", label: "Reportes", icon: ClipboardList },
        { href: "/ajustes", label: "Ajustes", icon: Settings },
      ];

  const matches = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const isActive = (item: NavItem) =>
    matches(item.href) || (item.also ?? []).some(matches);

  return (
    <>
      {/* Sidebar en desktop */}
      <aside className="bg-card hidden w-56 shrink-0 flex-col border-r p-4 md:flex">
        <div className="mb-6 px-2">
          <Logo className="text-xl" />
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const { href, label, icon: Icon } = item;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
                {href === "/ajustes" && pendingInvitations > 0 ? (
                  <Badge count={pendingInvitations} className="ml-auto" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Bottom nav en mobile */}
      <nav className="bg-card fixed inset-x-0 bottom-0 z-40 flex border-t md:hidden">
        {items.map((item) => {
          const { href, label, icon: Icon } = item;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
                isActive(item) ? "text-primary-text" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon className="size-5" />
                {href === "/ajustes" && pendingInvitations > 0 ? (
                  <Badge
                    count={pendingInvitations}
                    className="absolute -top-1.5 -right-2.5"
                  />
                ) : null}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-label={`${count} invitación(es) pendiente(s)`}
      className={cn(
        "bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
        className,
      )}
    >
      {count}
    </span>
  );
}
