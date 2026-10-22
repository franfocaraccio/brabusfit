import Link from "next/link";
import { notFound } from "next/navigation";
import { Dumbbell, Pencil, Salad } from "lucide-react";

import {
  ageFrom,
  formatDate,
  formatDisplayDate,
  formatSessionDate,
  goalLabel,
  levelLabel,
  sexLabel,
  summarizeHistory,
} from "@brabus/shared";
import {
  getClient,
  getProgressSessions,
  getClientPlans,
  getNutritionOverview,
  getRoutinesOverview,
  visibleLogs,
} from "@brabus/supabase";

import { LinkTile } from "@/components/app/link-tile";
import { ClientActions } from "@/components/clients/client-actions";
import { AccessBadge } from "@/components/clients/clients-list";
import { ProgressView } from "@/components/progress/progress-view";
import { SegmentedTabs } from "@/components/progress/segmented-tabs";
import { NewClientRoutine } from "@/components/routines/assign-routine";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { userId, profile } = await requireProfile();
  if (!profile.is_coach) notFound();

  const supabase = await createClient();
  const [detail, overview, nutrition, plans] = await Promise.all([
    getClient(supabase, userId, clientId),
    getRoutinesOverview(supabase, userId),
    getNutritionOverview(supabase, userId),
    getClientPlans(supabase, clientId),
  ]);
  if (!detail) notFound();
  const { name, data, sessions, routines, appAccess } = detail;
  const hasApp = appAccess === "active" && detail.studentId;
  const progress = hasApp ? await getProgressSessions(supabase, detail.studentId!) : [];

  const age = ageFrom(data.birth_date);
  const facts: [string, string | null][] = [
    ["Teléfono", data.phone || null],
    ["Email", data.email || null],
    [
      "Nacimiento",
      data.birth_date ? `${formatDisplayDate(data.birth_date)}${age !== null ? ` (${age} años)` : ""}` : null,
    ],
    ["Sexo", sexLabel(data.sex || null)],
    ["Estatura", data.height_cm ? `${data.height_cm.replace(".", ",")} cm` : null],
    ["Peso inicial", data.initial_weight_kg ? `${data.initial_weight_kg.replace(".", ",")} kg` : null],
    ["Objetivo", goalLabel(data.goal || null)],
    ["Nivel", levelLabel(data.level || null)],
    ["Cliente desde", formatDate(detail.createdAt)],
  ];

  const noApp = (text: string) => (
    <Card key={text} className="p-8 text-center">
      <p className="text-muted-foreground text-sm">{text}</p>
    </Card>
  );

  const ficha = (
    <div key="ficha" className="space-y-3">
      <Card className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className={cn("text-sm", !value && "text-muted-foreground")}>{value ?? "—"}</p>
          </div>
        ))}
      </Card>
      {data.injuries ? (
        <Card className="space-y-1 p-4">
          <p className="text-muted-foreground text-xs">Lesiones / patologías</p>
          <p className="text-sm whitespace-pre-line">{data.injuries}</p>
        </Card>
      ) : null}
      {data.notes ? (
        <Card className="space-y-1 p-4">
          <p className="text-muted-foreground text-xs">Notas privadas</p>
          <p className="text-sm whitespace-pre-line">{data.notes}</p>
        </Card>
      ) : null}
    </div>
  );

  const workouts = !hasApp ? (
    noApp(
      appAccess === "pending"
        ? "Vas a ver sus entrenamientos cuando acepte la invitación."
        : "Sin app: sus entrenamientos no se registran. Invitalo a la app para seguir su progreso.",
    )
  ) : sessions.length === 0 ? (
    noApp("Todavía no registró entrenamientos.")
  ) : (
    <div key="entrenamientos" className="space-y-3">
      {sessions.map((s) => {
        const logs = visibleLogs(s);
        return (
          <Link key={s.id} href={`/sesiones/${s.id}`} className="block">
            <Card className="hover:ring-primary/40 space-y-3 p-4 transition">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {s.routine?.name} · {s.day?.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatSessionDate(s.finished_at ?? s.started_at)}
                </span>
              </div>
              <div className="space-y-2">
                {logs.map((l, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{l.exercise?.name ?? "Ejercicio"}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {summarizeHistory({
                        sets: [...l.set_logs].sort((a, b) => a.set_number - b.set_number),
                        note: l.note,
                      })}
                    </span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-muted-foreground text-xs">Sin series registradas.</p>
                )}
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/clientes" className="text-muted-foreground hover:text-foreground text-sm">
          ← Clientes
        </Link>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {name}
              <AccessBadge status={detail.status} />
              {detail.archived ? (
                <span className="bg-muted text-muted-foreground rounded px-1.5 text-[10px] font-semibold">
                  Archivado
                </span>
              ) : null}
            </h1>
            {detail.username ? (
              <p className="text-muted-foreground text-sm">@{detail.username}</p>
            ) : null}
          </div>
          <Link
            href={`/clientes/${clientId}/editar`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Pencil className="size-4" /> Editar ficha
          </Link>
        </div>
        <ClientActions
          clientId={clientId}
          name={name}
          email={data.email}
          appAccess={appAccess}
          archived={detail.archived}
          routineCount={routines.length}
        />
      </div>

      {detail.status === "invited" && (
        <Card className="border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm">
            <span className="font-semibold">Invitación pendiente.</span> Ya tiene cuenta: va a ver
            lo que le armes cuando acepte. Su progreso aparece después de aceptar.
          </p>
        </Card>
      )}
      {detail.status === "unregistered" && (
        <Card className="border-sky-500/40 bg-sky-500/10 p-4">
          <p className="text-sm">
            <span className="font-semibold">Usuario no registrado.</span> Lo invitaste con{" "}
            {data.email}, pero todavía no creó su cuenta. Cuando se registre con ese email le va a
            aparecer la invitación.
          </p>
        </Card>
      )}

      <SegmentedTabs
        tabs={[
          { id: "ficha", label: "Ficha", content: ficha },
          {
            id: "rutinas",
            label: `Rutinas (${routines.length})`,
            content: (
              <div key="rutinas" className="space-y-3">
                <div className="flex justify-end">
                  <NewClientRoutine
                    clientId={clientId}
                    clientName={name}
                    folders={overview.folders}
                    templates={overview.routines}
                  />
                </div>
                {routines.length === 0 ? (
                  noApp("Todavía no le armaste rutinas. Creale una desde cero o a partir de una plantilla.")
                ) : (
                  <div className="space-y-2.5">
                    {routines.map((r) => (
                      <LinkTile key={r.id} href={`/rutinas/${r.id}`} title={r.name} icon={Dumbbell} />
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "nutricion",
            label: `Nutrición (${plans.length})`,
            content: (
              <div key="nutricion" className="space-y-3">
                <div className="flex justify-end">
                  <NewClientRoutine
                    kind="nutrition"
                    clientId={clientId}
                    clientName={name}
                    folders={nutrition.folders}
                    templates={nutrition.plans}
                  />
                </div>
                {plans.length === 0 ? (
                  noApp("Todavía no le armaste planes de nutrición. Crealo desde cero o a partir de una plantilla.")
                ) : (
                  <div className="space-y-2.5">
                    {plans.map((p) => (
                      <LinkTile
                        key={p.id}
                        href={`/nutricion/${p.id}`}
                        title={p.name}
                        subtitle={p.isCurrent ? "Vigente" : undefined}
                        icon={Salad}
                        accent={p.isCurrent}
                      />
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "progreso",
            label: "Progreso",
            content: hasApp ? (
              <ProgressView
                key="progreso"
                sessions={progress}
                emptyText="Este cliente todavía no registró entrenamientos en tus rutinas."
              />
            ) : (
              noApp(
                appAccess === "pending"
                  ? "Vas a ver su progreso cuando acepte la invitación."
                  : "Sin app: el progreso se ve cuando el cliente registra sus entrenamientos en la app.",
              )
            ),
          },
          { id: "entrenamientos", label: "Entrenamientos", content: workouts },
        ]}
      />
    </div>
  );
}
