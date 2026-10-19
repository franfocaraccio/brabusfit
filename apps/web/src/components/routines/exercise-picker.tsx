"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";

import {
  findCatalogByName,
  MUSCLE_GROUPS,
  muscleGroupLabel,
  searchCatalog,
  type CatalogEntry,
  type MuscleGroup,
} from "@brabus/shared";

import { createCatalogEntry } from "@/lib/actions/catalog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Máximo de resultados que se dibujan (el resto aparece al buscar). */
const MAX_RESULTS = 80;

/**
 * Selector de ejercicio del catálogo: buscador, filtro por grupo muscular y
 * "Crear" para agregar un ejercicio propio si no existe.
 */
export function ExercisePicker({
  value,
  catalog,
  onChange,
  onCreated,
}: {
  value: CatalogEntry | null;
  catalog: CatalogEntry[];
  onChange: (entry: CatalogEntry) => void;
  /** Ejercicio propio recién creado (para sumarlo al catálogo local). */
  onCreated: (entry: CatalogEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [newGroup, setNewGroup] = useState<MuscleGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const results = searchCatalog(catalog, query, group);
  const exact = findCatalogByName(catalog, query);
  const canCreate = query.trim() !== "" && !exact;

  // El buscador se limpia al abrir (no al cerrar: durante la animación de
  // cierre el input todavía puede recibir texto).
  const openPicker = () => {
    setQuery("");
    setGroup(null);
    setCreating(false);
    setNewGroup(null);
    setError(null);
    setOpen(true);
  };
  const close = () => setOpen(false);

  const pick = (entry: CatalogEntry) => {
    onChange(entry);
    close();
  };

  const create = () => {
    if (!newGroup) {
      setError("Elegí el grupo muscular.");
      return;
    }
    startTransition(async () => {
      const result = await createCatalogEntry({ name: query, muscleGroup: newGroup });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.data);
      pick(result.data);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className={cn(
          "border-input bg-input/40 flex h-10 w-full items-center gap-2 rounded-xl border px-3.5 text-left text-sm transition-colors",
          "hover:border-ring/60",
          !value && "text-muted-foreground",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{value ? value.name : "Elegí un ejercicio"}</span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? openPicker() : close())}>
        <DialogContent className="gap-3">
          <DialogHeader>
            <DialogTitle>{creating ? "Nuevo ejercicio" : "Elegí un ejercicio"}</DialogTitle>
          </DialogHeader>

          {creating ? (
            <div className="space-y-3">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
              <p className="text-muted-foreground text-xs">
                Grupo muscular. Este ejercicio solo lo vas a ver vos.
              </p>
              <GroupChips value={newGroup} onChange={setNewGroup} />
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setCreating(false)} disabled={pending}>
                  Volver
                </Button>
                <Button className="flex-1" onClick={create} disabled={pending || !query.trim()}>
                  {pending ? "Creando…" : "Crear y elegir"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar ejercicio…"
                  className="pl-9"
                  autoFocus
                />
              </div>
              <GroupChips value={group} onChange={setGroup} allowAll />

              <div className="-mx-1 max-h-[45vh] space-y-0.5 overflow-y-auto px-1">
                {results.slice(0, MAX_RESULTS).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => pick(e)}
                    className={cn(
                      "hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                      value?.id === e.id && "bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    {e.owner_id ? (
                      <span className="bg-primary/15 text-primary rounded px-1.5 text-[10px] font-semibold">
                        Propio
                      </span>
                    ) : null}
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {muscleGroupLabel(e.muscle_group)}
                    </span>
                  </button>
                ))}
                {results.length === 0 && (
                  <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                    No se encontró ningún ejercicio.
                  </p>
                )}
              </div>

              {canCreate && (
                <Button
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => {
                    setCreating(true);
                    setNewGroup(group);
                    setError(null);
                  }}
                >
                  <Plus className="size-4" /> Crear «{query.trim()}»
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupChips({
  value,
  onChange,
  allowAll,
}: {
  value: MuscleGroup | null;
  onChange: (g: MuscleGroup | null) => void;
  allowAll?: boolean;
}) {
  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowAll && (
        <button type="button" className={chip(value === null)} onClick={() => onChange(null)}>
          Todos
        </button>
      )}
      {MUSCLE_GROUPS.filter((g) => allowAll || g.value !== "otros").map((g) => (
        <button
          key={g.value}
          type="button"
          className={chip(value === g.value)}
          onClick={() => onChange(g.value)}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}
