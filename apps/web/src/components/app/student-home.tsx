"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Salad } from "lucide-react";

import {
  WEEKDAY_INITIALS,
  fitConsistencyGrid,
  longDate,
  shortDate,
  monthLabels,
  studentDashboard,
  type WeekSummary,
} from "@brabus/shared";
import type { HomePlan, HomeRoutine } from "@brabus/supabase";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** Inicio del alumno: semana en curso, consistencia, su rutina y su plan. */
export function StudentHome({
  firstName,
  finishedAt,
  routine,
  plan,
}: {
  firstName: string;
  finishedAt: string[];
  routine: HomeRoutine | null;
  plan: HomePlan | null;
}) {
  // Las fechas dependen de la hora local del navegador (el servidor está en UTC):
  // se calculan recién en el cliente.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const goal = routine && routine.dayCount > 0 ? routine.dayCount : null;
  // La grilla muestra las semanas que entran en el ancho de la tarjeta.
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setGridWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fit = gridWidth
    ? fitConsistencyGrid(gridWidth, {
        cell: CELL,
        gap: CELL_GAP,
        label: LABEL_W,
      })
    : null;
  const stats = mounted
    ? studentDashboard(finishedAt, goal, undefined, fit?.weeks)
    : null;

  return (
    <div className="space-y-4">
      <div className="animate-rise">
        <h1 className="text-2xl font-bold tracking-tight">Hola, {firstName}</h1>
        <p className="text-muted-foreground min-h-5 text-sm">
          {mounted ? longDate() : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <div className="text-muted-foreground flex items-baseline justify-between text-xs">
            <span>Semana en curso</span>
            {goal ? <span>Objetivo {goal}</span> : null}
          </div>
          <p className="text-3xl font-semibold">
            {stats?.daysThisWeek ?? "–"}
            {goal ? (
              <span className="text-muted-foreground text-base"> / {goal}</span>
            ) : null}
          </p>
          <div className="flex justify-between">
            {WEEKDAY_INITIALS.map((d, i) => {
              const done = stats?.thisWeek[i] ?? false;
              const today = stats?.todayIndex === i;
              const future = stats ? i > stats.todayIndex : false;
              return (
                <span
                  key={i}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-xs font-medium",
                    done
                      ? "bg-primary text-primary-foreground"
                      : today
                        ? "border-primary text-foreground border-[1.5px]"
                        : "bg-muted",
                    !done &&
                      !today &&
                      (future
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground"),
                  )}
                >
                  {d}
                </span>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-muted-foreground text-xs">Consistencia</p>
          <div ref={gridRef} style={{ minHeight: GRID_H }}>
            {fit && stats ? (
              <ConsistencyGrid weeks={stats.weeks} cell={fit.cell} />
            ) : null}
          </div>
          {stats ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Stat
                label="Promedio"
                value={
                  stats.average === null
                    ? "—"
                    : `${stats.average.toLocaleString("es-AR", { maximumFractionDigits: 1 })} / sem`
                }
              />
              {goal ? (
                <Stat
                  label="Racha"
                  value={`${stats.streak} ${stats.streak === 1 ? "semana" : "semanas"}`}
                />
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      {routine ? (
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-orange-500 via-orange-700 to-[#3b1405] p-5">
          <div className="pointer-events-none absolute -top-8 -right-8 size-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-10 -bottom-14 size-32 rounded-full bg-white/5" />
          <p className="text-[11px] font-semibold tracking-widest text-white/75">
            TU RUTINA
          </p>
          <p className="mt-1 text-xl font-semibold text-white">
            {routine.name}
          </p>
          <p className="mb-4 text-sm text-white/80">
            {routine.lastDayName
              ? `Último entrenamiento: ${routine.lastDayName}`
              : routine.coachName
                ? `Armada por ${routine.coachName}`
                : "Todavía no la entrenaste"}
          </p>
          <Link
            href={`/rutinas/${routine.id}`}
            className="relative inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-orange-700 transition hover:bg-white/90"
          >
            Continuar <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <Card className="p-5 text-center">
          <p className="text-muted-foreground text-sm">
            Todavía no tenés una rutina. Cuando tu coach te arme una, o crees la
            tuya, va a aparecer acá.
          </p>
          <Link
            href="/rutinas"
            className="text-primary-text mt-2 inline-block text-sm font-medium"
          >
            Ir a Entrenamiento
          </Link>
        </Card>
      )}

      {plan ? <PlanCard plan={plan} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      {label} <span className="text-foreground font-semibold">{value}</span>
    </p>
  );
}

const CELL = 14;
const CELL_GAP = 3;
const LABEL_W = 12;
/** Alto de la grilla (meses + 7 filas) mientras se mide el ancho. */
const GRID_H = 13 + 7 * (CELL + CELL_GAP);

/** Grilla tipo GitHub: una columna por semana, una fila por día (L a D). */
function ConsistencyGrid({
  weeks,
  cell,
}: {
  weeks: WeekSummary[];
  cell: number;
}) {
  const months = monthLabels(weeks);
  return (
    <div className="flex flex-col" style={{ gap: CELL_GAP }}>
      <div className="flex" style={{ gap: CELL_GAP }}>
        <span style={{ width: LABEL_W }} />
        {weeks.map((_, wi) => (
          <span
            key={wi}
            className="text-muted-foreground h-[13px] overflow-visible text-[9px] whitespace-nowrap"
            style={{ width: cell }}
          >
            {months[wi]}
          </span>
        ))}
      </div>
      {WEEKDAY_INITIALS.map((d, di) => (
        <div key={di} className="flex items-center" style={{ gap: CELL_GAP }}>
          <span
            className="text-muted-foreground text-[9px]"
            style={{ width: LABEL_W }}
          >
            {di % 2 === 0 ? d : ""}
          </span>
          {weeks.map((w, wi) => {
            const state = w.daily[di];
            const date = new Date(w.start);
            date.setDate(date.getDate() + di);
            return (
              <span
                key={wi}
                title={
                  state === "future"
                    ? undefined
                    : `${shortDate(date)}: ${state === "done" ? "entrenaste" : "sin entrenar"}`
                }
                className={cn(
                  "shrink-0 rounded-[3px]",
                  state === "done"
                    ? "bg-primary"
                    : state === "rest"
                      ? "bg-muted"
                      : "border-muted border",
                )}
                style={{ width: cell, height: cell }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

const MACROS = [
  {
    key: "protein",
    label: "Proteínas",
    kcalPerGram: 4,
    color: "bg-orange-500",
  },
  { key: "carbs", label: "Carbohidratos", kcalPerGram: 4, color: "bg-sky-400" },
  { key: "fat", label: "Grasas", kcalPerGram: 9, color: "bg-violet-400" },
] as const;

/** "Tu plan": el plan de nutrición vigente, con calorías, macros y comidas. */
function PlanCard({ plan }: { plan: HomePlan }) {
  const macros = plan.macros;
  const total = macros
    ? MACROS.reduce((sum, m) => sum + macros[m.key] * m.kcalPerGram, 0)
    : 0;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-widest">
            TU PLAN
          </p>
          <p className="mt-1 truncate text-lg font-semibold">{plan.name}</p>
          {plan.coachName ? (
            <p className="text-muted-foreground text-sm">
              Armado por {plan.coachName}
            </p>
          ) : null}
        </div>
        <Salad className="text-primary-text size-5 shrink-0" />
      </div>

      {plan.kcal ? (
        <p className="text-2xl font-semibold">
          {plan.kcal}
          <span className="text-muted-foreground text-sm font-normal">
            {" "}
            kcal por día
          </span>
        </p>
      ) : null}

      {macros && total > 0 ? (
        <div className="space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full">
            {MACROS.map((m) => (
              <div
                key={m.key}
                className={m.color}
                style={{
                  width: `${((macros[m.key] * m.kcalPerGram) / total) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {MACROS.map((m) => (
              <span key={m.key} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", m.color)} />
                {m.label}{" "}
                <span className="text-foreground font-medium">
                  {Math.round(macros[m.key])} g
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {plan.meals.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {plan.meals.length} {plan.meals.length === 1 ? "comida" : "comidas"}:{" "}
          {plan.meals.join(" · ")}
        </p>
      ) : null}

      <Link
        href={`/nutricion/${plan.id}`}
        className="text-primary-text inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        Ver plan <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
