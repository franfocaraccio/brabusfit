"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/** Pestañas simples (ej. Progreso / Entrenamientos en el detalle del alumno). */
export function SegmentedTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div className="space-y-4">
      <div className="bg-muted inline-flex w-fit rounded-lg p-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              active === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.id === active)?.content}
    </div>
  );
}
