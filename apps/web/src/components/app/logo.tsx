import { cn } from "@/lib/utils";

/** Wordmark de Brabus Fit (Barlow Condensed, mayúsculas, "Fit" con gradiente naranja). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-display leading-none font-bold", className)}>
      Brabus
      <span className="bg-linear-to-r from-amber-400 to-primary bg-clip-text text-transparent">
        {" "}
        Fit
      </span>
    </span>
  );
}
