"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";

import {
  buildProgress,
  DEFAULT_PERIOD,
  PERIODS,
  type ChartSpec,
  type Period,
  type ProgressSession,
} from "@brabus/shared";

import { BarChart, LineChart } from "@/components/progress/charts";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Gráficos de evolución: ejercicio (agrupado por nombre entre rutinas),
 * período, récords, peso máximo, volumen y frecuencia semanal.
 */
export function ProgressView({
  sessions,
  emptyText = "Todavía no hay entrenamientos guardados. Cuando guardes una sesión, acá vas a ver tu evolución.",
}: {
  sessions: ProgressSession[];
  emptyText?: string;
}) {
  const [key, setKey] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const { exercises, selected, records, charts, frequency } = buildProgress(
    sessions,
    key,
    period,
  );

  if (!selected) {
    return (
      <Card className="p-8 text-center">
        <TrendingUp className="text-muted-foreground mx-auto size-8" />
        <p className="text-muted-foreground mt-3 text-sm">{emptyText}</p>
      </Card>
    );
  }

  const items = Object.fromEntries(exercises.map((e) => [e.key, e.name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={selected.key}
          onValueChange={(v) => setKey(v as string)}
          items={items}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Elegí un ejercicio" />
          </SelectTrigger>
          <SelectContent>
            {exercises.map((e) => (
              <SelectItem key={e.key} value={e.key}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="bg-muted inline-flex w-fit rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {records.map((r) => (
            <Card key={r.label} className="gap-1 p-3.5">
              <span className="text-muted-foreground text-xs font-medium">{r.label}</span>
              <span className="text-lg font-bold tracking-tight">{r.value}</span>
              <span className="text-muted-foreground text-xs">{r.detail}</span>
            </Card>
          ))}
        </div>
      )}

      <ChartCard spec={charts.main} kind="line" />
      <ChartCard spec={charts.volume} kind="bar" />
      <ChartCard spec={frequency} kind="bar" />
    </div>
  );
}

function ChartCard({ spec, kind }: { spec: ChartSpec; kind: "line" | "bar" }) {
  return (
    <Card className="gap-2 p-4">
      <div>
        <h3 className="text-sm font-semibold">{spec.title}</h3>
        <p className="text-muted-foreground text-xs">{spec.subtitle}</p>
      </div>
      {spec.points.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Sin datos en este período.
        </p>
      ) : kind === "line" ? (
        <LineChart points={spec.points} />
      ) : (
        <BarChart points={spec.points} />
      )}
    </Card>
  );
}
