"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  Dumbbell,
  Folder as FolderIcon,
  Plus,
  Search,
  User,
  UserCheck,
} from "lucide-react";

import { LinkTile } from "@/components/app/link-tile";
import { FolderActions } from "@/components/routines/folder-actions";
import { NewFolderButton } from "@/components/routines/new-folder-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type {
  ClientRoutineGroup,
  CoachRoutineLite,
  FolderLite,
  RoutineLite,
} from "@brabus/supabase";

const ROOT_GROUP = "__root__";

type Group = {
  id: string;
  name: string;
  subtitle: string;
  icon: typeof FolderIcon;
  badge?: { text: string; tone: "pending" | "muted" };
  deletable: boolean;
  items: { id: string; name: string }[];
};

const countLabel = (n: number) => `${n} ${n === 1 ? "rutina" : "rutinas"}`;

export function RoutinesBrowser({
  isCoach,
  folders,
  routines,
  clients,
  fromCoaches,
}: {
  isCoach: boolean;
  folders: FolderLite[];
  /** Plantillas (coach) o rutinas propias (alumno). */
  routines: RoutineLite[];
  /** Coach: rutinas de sus clientes, agrupadas por ficha. */
  clients: ClientRoutineGroup[];
  /** Alumno: rutinas que le armaron sus coaches. */
  fromCoaches: CoachRoutineLite[];
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(q);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hasNothing =
    routines.length === 0 &&
    folders.length === 0 &&
    clients.length === 0 &&
    fromCoaches.length === 0;

  const searchBar = (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isCoach ? "Buscar cliente, carpeta o rutina…" : "Buscar rutina…"}
          className="pl-9"
        />
      </div>
      {isCoach && <NewFolderButton />}
    </div>
  );

  // ----- Empty state global -----
  if (hasNothing) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm">Todavía no tenés rutinas.</p>
        <Link href="/rutinas/crear" className={cn(buttonVariants(), "mt-4")}>
          <Plus className="size-4" /> {isCoach ? "Crear mi primera plantilla" : "Crear mi primera rutina"}
        </Link>
      </Card>
    );
  }

  // ============================ ALUMNO ============================
  if (!isCoach) {
    const coachList = fromCoaches.filter(
      (r) => !q || matches(r.name) || (r.coachName ? matches(r.coachName) : false),
    );
    const list = routines.filter((r) => !q || matches(r.name));
    return (
      <div className="space-y-6">
        {searchBar}
        {coachList.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
              <UserCheck className="size-4" /> De mis coaches
            </h2>
            <div className="stagger space-y-2.5">
              {coachList.map((r) => (
                <LinkTile
                  key={r.id}
                  href={`/rutinas/${r.id}`}
                  title={r.name}
                  subtitle={r.coachName ? `Coach: ${r.coachName}` : "De tu coach"}
                  icon={Dumbbell}
                  accent
                />
              ))}
            </div>
          </section>
        )}
        <section className="space-y-2.5">
          <h2 className="text-muted-foreground text-sm font-semibold">Mis rutinas</h2>
          {list.length > 0 ? (
            <div className="stagger space-y-2.5">
              {list.map((r) => (
                <LinkTile key={r.id} href={`/rutinas/${r.id}`} title={r.name} icon={Dumbbell} />
              ))}
            </div>
          ) : (
            <NoResults hasQuery={q !== ""} />
          )}
        </section>
      </div>
    );
  }

  // ============================ COACH ============================
  const clientGroups: Group[] = clients.map((c) => ({
    id: `client:${c.clientId}`,
    name: c.name,
    subtitle: countLabel(c.routines.length),
    icon: User,
    badge: c.archived ? { text: "Archivado", tone: "muted" } : undefined,
    deletable: false,
    items: c.routines,
  }));

  const rootRoutines = routines.filter((r) => !r.folder_id);
  const templateGroups: Group[] = [
    ...folders.map((f) => ({
      id: f.id,
      name: f.name,
      subtitle: countLabel(routines.filter((r) => r.folder_id === f.id).length),
      icon: FolderIcon,
      deletable: true,
      items: routines.filter((r) => r.folder_id === f.id),
    })),
    ...(rootRoutines.length > 0
      ? [
          {
            id: ROOT_GROUP,
            name: "Sin carpeta",
            subtitle: countLabel(rootRoutines.length),
            icon: FolderIcon,
            deletable: false,
            items: rootRoutines,
          },
        ]
      : []),
  ];

  const visible = (groups: Group[]) =>
    groups.filter((g) => !q || matches(g.name) || g.items.some((r) => matches(r.name)));

  const renderGroups = (groups: Group[], empty: string) => {
    const list = visible(groups);
    if (list.length === 0) {
      return q ? (
        <NoResults hasQuery />
      ) : (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground text-sm">{empty}</p>
        </Card>
      );
    }
    return list.map((group) => {
      const nameMatch = !q || matches(group.name);
      const displayItems = nameMatch ? group.items : group.items.filter((r) => matches(r.name));
      const isOpen = q ? true : expanded.has(group.id);
      const Icon = group.icon;

      return (
        <div key={group.id} className="space-y-2">
          <div className="bg-card flex items-center gap-2 rounded-xl p-3.5 ring-1 ring-foreground/10 transition hover:ring-primary/30">
            <button
              onClick={() => toggle(group.id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{group.name}</span>
                  {group.badge ? (
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 text-[10px] font-semibold",
                        group.badge.tone === "pending"
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {group.badge.text}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-xs">{group.subtitle}</span>
              </span>
              <ChevronDown
                className={cn(
                  "text-muted-foreground size-5 shrink-0 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {group.deletable && <FolderActions folderId={group.id} folderName={group.name} />}
          </div>

          {isOpen && (
            <div className="stagger space-y-2 pl-3">
              {displayItems.length > 0 ? (
                displayItems.map((r) => (
                  <LinkTile key={r.id} href={`/rutinas/${r.id}`} title={r.name} icon={Dumbbell} />
                ))
              ) : (
                <p className="text-muted-foreground px-1 text-sm">Carpeta vacía.</p>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {searchBar}

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold">Rutinas de clientes</h2>
        {renderGroups(
          clientGroups,
          "Todavía no armaste rutinas para clientes. Entrá a una plantilla y tocá «Asignar a cliente», o creala desde Clientes.",
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold">Plantillas</h2>
        {renderGroups(templateGroups, "Todavía no tenés plantillas.")}
      </section>
    </div>
  );
}

function NoResults({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Card className="p-6 text-center">
      <p className="text-muted-foreground text-sm">
        {hasQuery ? "No se encontraron resultados." : "Todavía no hay rutinas acá."}
      </p>
    </Card>
  );
}
