"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";

import {
  WEEKDAY_INITIALS,
  longDate,
  shortDate,
  studentDashboard,
} from "@brabus/shared";
import type { HomeRoutine } from "@brabus/supabase";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** Inicio del alumno: semana en curso, consistencia de 8 semanas y su rutina. */
export function StudentHome({
  firstName,
  finishedAt,
  routine,
}: {
  firstName: string;
  finishedAt: string[];
  routine: HomeRoutine | null;
}) {
  // Las fechas dependen de la hora local del navegador (el servidor está en UTC):
  // se calculan recién en el cliente.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const goal = routine && routine.dayCount > 0 ? routine.dayCount : null;
  const stats = mounted ? studentDashboard(finishedAt, goal) : null;
  const max = Math.max(goal ?? 0, ...(stats?.weeks.map((w) => w.days) ?? [0]), 1);

  return (
    <div className="space-y-4">
      <div className="animate-rise">
        <h1 className="text-2xl font-bold tracking-tight">Hola, {firstName}</h1>
        <p className="text-muted-foreground min-h-5 text-sm">{mounted ? longDate() : ""}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3 p-4">
          <div className="text-muted-foreground flex items-baseline justify-between text-xs">
            <span>Semana en curso</span>
            {goal ? <span>Objetivo {goal}</span> : null}
          </div>
          <p className="text-3xl font-semibold">
            {stats?.daysThisWeek ?? "–"}
            {goal ? <span className="text-muted-foreground text-base"> / {goal}</span> : null}
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
                    !done && !today && (future ? "text-muted-foreground/50" : "text-muted-foreground"),
                  )}
                >
                  {d}
                </span>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-2 p-4">
          <div className="text-muted-foreground flex items-baseline justify-between text-xs">
            <span>Consistencia · 8 semanas</span>
            {stats ? (
              <span className="text-foreground">
                Promedio {stats.average.toLocaleString("es-AR", { maximumFractionDigits: 1 })} / sem
              </span>
            ) : null}
          </div>
          <div className="relative flex h-24 items-end gap-2 border-b">
            {goal ? (
              <div
                className="border-muted-foreground/60 absolute inset-x-0 border-t border-dashed"
                style={{ bottom: `${(goal / max) * 100}%` }}
              />
            ) : null}
            {(stats?.weeks ?? []).map((w, i, all) => {
              const current = i === all.length - 1;
              const below = goal !== null && !current && w.days < goal;
              return (
                <div
                  key={i}
                  title={`Semana del ${shortDate(w.start)}: ${w.days} ${w.days === 1 ? "día" : "días"}`}
                  className={cn(
                    "flex-1 rounded-t",
                    current ? "bg-primary/55" : below ? "bg-primary/35" : "bg-primary",
                  )}
                  style={{ height: `${Math.max((w.days / max) * 100, w.days ? 6 : 2)}%` }}
                />
              );
            })}
          </div>
          <div className="text-muted-foreground flex justify-between text-[11px]">
            <span>{stats ? shortDate(stats.weeks[0].start) : ""}</span>
            <span>esta</span>
          </div>
          {goal && stats ? (
            <p className="text-muted-foreground text-xs">
              {stats.streak > 0
                ? `Racha: ${stats.streak} ${stats.streak === 1 ? "semana" : "semanas"} cumpliendo el objetivo`
                : "Cumplí el objetivo de la semana para empezar una racha"}
            </p>
          ) : null}
        </Card>
      </div>

      {routine ? (
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-orange-500 via-orange-700 to-[#3b1405] p-5">
          <div className="pointer-events-none absolute -top-8 -right-8 size-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-10 -bottom-14 size-32 rounded-full bg-white/5" />
          <p className="text-[11px] font-semibold tracking-widest text-white/75">TU RUTINA</p>
          <p className="mt-1 text-xl font-semibold text-white">{routine.name}</p>
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
            Todavía no tenés una rutina. Cuando tu coach te arme una, o crees la tuya, va a
            aparecer acá.
          </p>
          <Link href="/rutinas" className="text-primary mt-2 inline-block text-sm font-medium">
            Ir a Entrenamiento
          </Link>
        </Card>
      )}
    </div>
  );
}
