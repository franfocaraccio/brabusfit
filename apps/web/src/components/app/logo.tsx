import { cn } from "@/lib/utils";

/** Wordmark de Brabus Fit (Unbounded, mayúsculas, "Fit" con gradiente naranja). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-logo leading-none font-bold whitespace-nowrap", className)}>
      Brabus
      <span className="bg-linear-to-r from-amber-400 to-primary bg-clip-text text-transparent">
        {" "}
        Fit
      </span>
    </span>
  );
}
