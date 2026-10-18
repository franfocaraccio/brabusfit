"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Home, User, Users } from "lucide-react";

import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AppNav({ isCoach }: { isCoach: boolean }) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/rutinas", label: "Rutinas", icon: Dumbbell },
    ...(isCoach
      ? [{ href: "/alumnos", label: "Alumnos", icon: Users }]
      : []),
    { href: "/perfil", label: "Perfil", icon: User },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Sidebar en desktop */}
      <aside className="bg-card hidden w-56 shrink-0 flex-col border-r p-4 md:flex">
        <div className="mb-6 px-2">
          <Logo className="text-2xl" />
        </div>
        <nav className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Bottom nav en mobile */}
      <nav className="bg-card fixed inset-x-0 bottom-0 z-40 flex border-t md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
              isActive(href)
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
