"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Search, Users } from "lucide-react";

import { CLIENT_STATUS_LABEL, formatDate, type ClientStatus } from "@brabus/shared";
import type { ClientSummary } from "@brabus/supabase";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function subtitle(c: ClientSummary) {
  const routines = `${c.routineCount} ${c.routineCount === 1 ? "rutina" : "rutinas"}`;
  if (c.appAccess !== "active") return routines;
  return `${routines} · ${
    c.lastActivity ? `última actividad ${formatDate(c.lastActivity)}` : "sin entrenamientos aún"
  }`;
}

/** Vinculado / Invitación pendiente / Usuario no registrado / Sin invitar. */
export function AccessBadge({ status }: { status: ClientStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 text-[10px] font-semibold whitespace-nowrap",
        status === "linked" && "bg-emerald-500/15 text-emerald-500",
        status === "invited" && "bg-amber-500/15 text-amber-500",
        status === "unregistered" && "bg-sky-500/15 text-sky-400",
        status === "none" && "bg-muted text-muted-foreground",
      )}
    >
      {CLIENT_STATUS_LABEL[status]}
    </span>
  );
}

export function ClientsList({ clients }: { clients: ClientSummary[] }) {
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);

  const q = query.trim().toLowerCase();
  const archivedCount = clients.filter((c) => c.archived).length;
  const list = clients.filter(
    (c) =>
      c.archived === archived &&
      (!q ||
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.username ?? "").includes(q)),
  );

  if (clients.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Users className="text-muted-foreground mx-auto size-8" />
        <p className="text-muted-foreground mt-3 text-sm">
          Todavía no tenés clientes. Creá su ficha: no hace falta que usen la app.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono…"
            className="pl-9"
          />
        </div>
        <div className="bg-muted inline-flex rounded-lg p-0.5">
          {[false, true].map((a) => (
            <button
              key={String(a)}
              type="button"
              onClick={() => setArchived(a)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                archived === a
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {a ? `Archivados (${archivedCount})` : `Activos (${clients.length - archivedCount})`}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground text-sm">
            {q ? "No se encontraron resultados." : archived ? "No hay clientes archivados." : "No hay clientes activos."}
          </p>
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden py-0">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3.5 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <AccessBadge status={c.status} />
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {c.username ? `@${c.username} · ` : c.phone ? `${c.phone} · ` : ""}
                  {subtitle(c)}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-4" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
