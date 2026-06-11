import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tile clickeable con el efecto del dashboard: chip con ícono, hover-lift,
 * glow naranja y flechita que se desliza. Reutilizable en listados.
 */
export function LinkTile({
  href,
  title,
  subtitle,
  icon: Icon,
  chip,
  accent,
  trailing,
}: {
  href: string;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Contenido custom del chip (ej. número de día). Tiene prioridad sobre icon. */
  chip?: React.ReactNode;
  /** Chip con gradiente naranja en vez de gris. */
  accent?: boolean;
  /** Nodo extra antes de la flechita (ej. un badge de estado). */
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group hover-lift bg-card flex items-center gap-4 rounded-xl p-4 ring-1 ring-foreground/10",
        "hover:ring-primary/40 hover:shadow-[0_10px_30px_-12px_rgba(249,115,22,0.45)]",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
          accent
            ? "bg-linear-to-b from-[#fb923c] to-[#f97316] text-primary-foreground shadow-[0_6px_18px_-6px_rgba(249,115,22,0.6)]"
            : "bg-muted text-foreground",
        )}
      >
        {chip ?? (Icon ? <Icon className="size-5" /> : null)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {subtitle ? (
          <span className="text-muted-foreground block truncate text-xs">
            {subtitle}
          </span>
        ) : null}
      </span>

      {trailing}

      <ChevronRight className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
