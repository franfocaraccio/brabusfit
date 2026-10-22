"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, CheckCircle2, Dumbbell, Salad } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  clientGrowth,
  longDate,
  shortMonth,
  trainedThisWeek,
} from "@brabus/shared";
import type { CoachHome as CoachHomeData } from "@brabus/supabase";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const noop = () => () => {};
const PREVIEW = 4;

/** Inicio del coach: pendientes, quién entrenó esta semana y evolución de clientes. */
export function CoachHome({
  firstName,
  data,
}: {
  firstName: string;
  data: CoachHomeData;
}) {
  // Semanas y meses en hora local del navegador (el servidor está en UTC).
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  return (
    <div className="space-y-4">
      <div className="animate-rise">
        <h1 className="text-2xl font-bold tracking-tight">Hola, {firstName}</h1>
        <p className="text-muted-foreground min-h-5 text-sm">
          {mounted ? longDate() : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PendingCard
          title="Rutinas pendientes"
          icon={Dumbbell}
          empty="Todos tus clientes tienen una rutina vigente."
          hint="sin rutina vigente"
          clients={data.noRoutine}
        />
        <PendingCard
          title="Dietas pendientes"
          icon={Salad}
          empty="Todos tus clientes tienen un plan vigente."
          hint="sin plan vigente"
          clients={data.noPlan}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WeekCard data={data} mounted={mounted} />
        <GrowthCard data={data} mounted={mounted} />
      </div>
    </div>
  );
}

function PendingCard({
  title,
  icon: Icon,
  hint,
  empty,
  clients,
}: {
  title: string;
  icon: LucideIcon;
  hint: string;
  empty: string;
  clients: { id: string; name: string }[];
}) {
  return (
    <Card className="space-y-3 p-4">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{title}</span>
        <Icon className="text-primary size-4" />
      </div>
      {clients.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 text-green-500" /> {empty}
        </p>
      ) : (
        <>
          <p className="text-3xl font-semibold">
            {clients.length}
            <span className="text-muted-foreground text-sm font-normal">
              {" "}
              {clients.length === 1 ? "cliente" : "clientes"} {hint}
            </span>
          </p>
          <ul className="divide-border divide-y text-sm">
            {clients.slice(0, PREVIEW).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}`}
                  className="hover:text-primary flex items-center justify-between py-2 transition-colors"
                >
                  <span className="truncate">{c.name}</span>
                  <ArrowRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          {clients.length > PREVIEW ? (
            <Link href="/clientes" className="text-primary text-sm font-medium">
              Ver {clients.length - PREVIEW} más
            </Link>
          ) : null}
        </>
      )}
    </Card>
  );
}

function WeekCard({
  data,
  mounted,
}: {
  data: CoachHomeData;
  mounted: boolean;
}) {
  const withApp = data.clients.filter(
    (c) => c.archivedAt === null && c.studentId,
  );
  const days = mounted
    ? trainedThisWeek(data.sessions)
    : new Map<string, number>();
  const rows = withApp
    .map((c) => ({ ...c, days: days.get(c.studentId!) ?? 0 }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, "es"));
  const trained = rows.filter((r) => r.days > 0).length;

  return (
    <Card className="space-y-3 p-4">
      <div className="text-muted-foreground text-xs">
        Entrenaron esta semana
      </div>
      {withApp.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Ninguno de tus clientes usa la app todavía. Invitalos desde su ficha.
        </p>
      ) : (
        <>
          <p className="text-3xl font-semibold">
            {mounted ? trained : "–"}
            <span className="text-muted-foreground text-base">
              {" "}
              / {withApp.length}
            </span>
            <span className="text-muted-foreground text-sm font-normal">
              {" "}
              con app
            </span>
          </p>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width]"
              style={{ width: `${(trained / withApp.length) * 100}%` }}
            />
          </div>
          <ul className="divide-border divide-y text-sm">
            {rows.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/clientes/${r.id}`}
                  className="hover:text-primary flex items-center justify-between gap-3 py-2 transition-colors"
                >
                  <span className="truncate">{r.name}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs",
                      r.days > 0
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {r.days > 0
                      ? `${r.days} ${r.days === 1 ? "día" : "días"}`
                      : "Sin entrenar"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {rows.length > 6 ? (
            <Link href="/clientes" className="text-primary text-sm font-medium">
              Ver todos
            </Link>
          ) : null}
        </>
      )}
    </Card>
  );
}

function GrowthCard({
  data,
  mounted,
}: {
  data: CoachHomeData;
  mounted: boolean;
}) {
  const months = mounted ? clientGrowth(data.clients) : [];
  const current = months.at(-1);
  const delta = current ? current.count - months[0].count : 0;
  const max = Math.max(...months.map((m) => m.count), 1);

  return (
    <Card className="space-y-3 p-4">
      <div className="text-muted-foreground flex items-baseline justify-between text-xs">
        <span>Clientes activos · 6 meses</span>
        {current && delta !== 0 ? (
          <span className={delta > 0 ? "text-green-500" : "text-red-500"}>
            {delta > 0 ? "+" : ""}
            {delta} en 6 meses
          </span>
        ) : null}
      </div>
      <p className="text-3xl font-semibold">{current?.count ?? "–"}</p>
      <div className="flex h-28 items-end gap-2 border-b">
        {months.map((m, i) => (
          <div
            key={i}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-muted-foreground text-[11px]">{m.count}</span>
            <div
              className={cn(
                "w-full rounded-t",
                i === months.length - 1 ? "bg-primary" : "bg-primary/45",
              )}
              style={{
                height: `${Math.max((m.count / max) * 80, m.count ? 6 : 2)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="text-muted-foreground flex gap-2 text-[11px]">
        {months.map((m, i) => (
          <span key={i} className="flex-1 text-center">
            {shortMonth(m.start)}
          </span>
        ))}
      </div>
      {current ? (
        <p className="text-muted-foreground text-xs">
          Este mes: {current.added} {current.added === 1 ? "alta" : "altas"} ·{" "}
          {current.removed} {current.removed === 1 ? "baja" : "bajas"}{" "}
          (archivados)
        </p>
      ) : null}
    </Card>
  );
}
