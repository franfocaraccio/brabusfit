"use client";

import { useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "dark", label: "Oscuro", hint: "El de siempre.", icon: Moon },
  {
    value: "light",
    label: "Claro",
    hint: "Fondo crema, ideal de día.",
    icon: Sun,
  },
  {
    value: "system",
    label: "Automático",
    hint: "Sigue la configuración de tu dispositivo.",
    icon: Monitor,
  },
] as const;

const noop = () => () => {};

/** Oscuro · Claro · Automático (se guarda en este dispositivo). */
export function AppearancePicker() {
  const { theme, setTheme } = useTheme();
  // El tema elegido se conoce recién en el navegador.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  return (
    <Card className="divide-border gap-0 divide-y py-0">
      {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={selected}
            className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <Icon className="text-primary-text size-5" />
            <span className="flex-1">
              <span className="block text-sm font-medium">{label}</span>
              <span className="text-muted-foreground block text-xs">
                {hint}
              </span>
            </span>
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border",
                selected
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input",
              )}
            >
              {selected ? <Check className="size-3.5" /> : null}
            </span>
          </button>
        );
      })}
    </Card>
  );
}
