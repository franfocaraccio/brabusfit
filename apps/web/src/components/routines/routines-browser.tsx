"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  Dumbbell,
  Folder as FolderIcon,
  Plus,
  Search,
  Share2,
} from "lucide-react";

import { LinkTile } from "@/components/app/link-tile";
import { FolderActions } from "@/components/routines/folder-actions";
import { NewFolderButton } from "@/components/routines/new-folder-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type {
  FolderLite,
  RoutineLite,
  SharedRoutineLite as SharedLite,
} from "@brabus/supabase";
import type {
  FolderLite,
  RoutineLite,
  SharedRoutineLite as SharedLite,
} from "@brabus/supabase";

const ROOT_GROUP = "__root__";

export function RoutinesBrowser({
  isCoach,
  folders,
  routines,
  shared,
}: {
  isCoach: boolean;
  folders: FolderLite[];
  routines: RoutineLite[];
  shared: SharedLite[];
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

  const sharedFiltered = shared.filter(
    (s) => !q || matches(s.name) || (s.coachName ? matches(s.coachName) : false),
  );

  const hasNothing =
    routines.length === 0 && folders.length === 0 && shared.length === 0;

  const searchBar = (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            isCoach ? "Buscar por carpeta o rutina…" : "Buscar rutina…"
          }
          className="pl-9"
        />
      </div>
      {isCoach && <NewFolderButton />}
    </div>
  );

  const sharedSection = sharedFiltered.length > 0 && (
    <section className="space-y-2.5">
      <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
        <Share2 className="size-4" /> Compartidas conmigo
      </h2>
      <div className="stagger space-y-2.5">
        {sharedFiltered.map((s) => (
          <LinkTile
            key={s.id}
            href={`/rutinas/${s.routineId}`}
            title={s.name}
            subtitle={s.coachName ? `Coach: ${s.coachName}` : "Compartida"}
            icon={Dumbbell}
            accent
          />
        ))}
      </div>
    </section>
  );

  // ----- Empty state global -----
  if (hasNothing) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Todavía no tenés rutinas.
        </p>
        <Link href="/rutinas/crear" className={cn(buttonVariants(), "mt-4")}>
          <Plus className="size-4" /> Crear mi primera rutina
        </Link>
      </Card>
    );
  }

  // ============================ ALUMNO ============================
  if (!isCoach) {
    const list = routines.filter((r) => !q || matches(r.name));
    return (
      <div className="space-y-6">
        {searchBar}
        {sharedSection}
        <section className="space-y-2.5">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Mis rutinas
          </h2>
          {list.length > 0 ? (
            <div className="stagger space-y-2.5">
              {list.map((r) => (
                <LinkTile
                  key={r.id}
                  href={`/rutinas/${r.id}`}
                  title={r.name}
                  icon={Dumbbell}
                />
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
  const rootRoutines = routines.filter((r) => !r.folder_id);
  const groups = [
    ...folders.map((f) => ({
      id: f.id,
      name: f.name,
      deletable: true,
      items: routines.filter((r) => r.folder_id === f.id),
    })),
    ...(rootRoutines.length > 0
      ? [
          {
            id: ROOT_GROUP,
            name: "Sin carpeta",
            deletable: false,
            items: rootRoutines,
          },
        ]
      : []),
  ];

  const visibleGroups = groups.filter(
    (g) => !q || matches(g.name) || g.items.some((r) => matches(r.name)),
  );

  return (
    <div className="space-y-6">
      {searchBar}
      {sharedSection}

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold">
          Carpetas
        </h2>

        {visibleGroups.length === 0 ? (
          <NoResults hasQuery={q !== ""} />
        ) : (
          visibleGroups.map((group) => {
            const nameMatch = !q || matches(group.name);
            const matched = group.items.filter((r) => matches(r.name));
            const displayItems = nameMatch ? group.items : matched;
            const isOpen = q ? true : expanded.has(group.id);

            return (
              <div key={group.id} className="space-y-2">
                <div className="bg-card flex items-center gap-2 rounded-xl p-3.5 ring-1 ring-foreground/10 transition hover:ring-primary/30">
                  <button
                    onClick={() => toggle(group.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                      <FolderIcon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {group.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {group.items.length} rutina(s)
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "text-muted-foreground size-5 shrink-0 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {group.deletable && (
                    <FolderActions
                      folderId={group.id}
                      folderName={group.name}
                    />
                  )}
                </div>

                {isOpen && (
                  <div className="stagger space-y-2 pl-3">
                    {displayItems.length > 0 ? (
                      displayItems.map((r) => (
                        <LinkTile
                          key={r.id}
                          href={`/rutinas/${r.id}`}
                          title={r.name}
                          icon={Dumbbell}
                        />
                      ))
                    ) : (
                      <p className="text-muted-foreground px-1 text-sm">
                        Carpeta vacía.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function NoResults({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Card className="p-6 text-center">
      <p className="text-muted-foreground text-sm">
        {hasQuery
          ? "No se encontraron resultados."
          : "Todavía no hay rutinas acá."}
      </p>
    </Card>
  );
}
