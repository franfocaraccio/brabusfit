import Link from "next/link";

/** Título de una subpágina de Ajustes, con la vuelta al menú. */
export function SettingsHeader({ title }: { title: string }) {
  return (
    <div>
      <Link
        href="/ajustes"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Ajustes
      </Link>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
    </div>
  );
}
