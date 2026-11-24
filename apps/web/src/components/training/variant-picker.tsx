import { EXERCISE_VARIANTS } from "@brabus/shared";

import { cn } from "@/lib/utils";

/** Variante con la que hizo el ejercicio (tocar la elegida la desmarca). */
export function VariantPicker({
  value,
  onToggle,
}: {
  value: string | null;
  onToggle: (variant: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground text-xs font-medium">
        Variante
      </span>
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="Variante"
      >
        {EXERCISE_VARIANTS.map((v) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onToggle(v)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
