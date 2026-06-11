import Link from "next/link";
import { Dumbbell, Folder as FolderIcon, Plus, Share2 } from "lucide-react";

import { LinkTile } from "@/components/app/link-tile";
import { NewFolderButton } from "@/components/routines/new-folder-button";
import { FolderActions } from "@/components/routines/folder-actions";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Folder, Routine } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type SharedRow = {
  id: string;
  routine: {
    id: string;
    name: string;
    owner: { first_name: string; last_name: string } | null;
  } | null;
};

export default async function RutinasPage() {
  const { userId } = await requireProfile();
  const supabase = await createClient();

  const [foldersRes, routinesRes, sharedRes] = await Promise.all([
    supabase.from("folders").select("*").eq("owner_id", userId).order("name"),
    supabase
      .from("routines")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("routine_shares")
      .select(
        "id, routine:routines(id, name, owner:profiles!routines_owner_id_fkey(first_name, last_name))",
      )
      .eq("shared_with_user_id", userId)
      .eq("status", "accepted"),
  ]);

  const folders = (foldersRes.data ?? []) as Folder[];
  const routines = (routinesRes.data ?? []) as Routine[];
  const shared = (sharedRes.data ?? []) as unknown as SharedRow[];

  const rootRoutines = routines.filter((r) => !r.folder_id);
  const byFolder = (folderId: string) =>
    routines.filter((r) => r.folder_id === folderId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Rutinas</h1>
        <Link
          href="/rutinas/crear"
          className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
        >
          <Plus className="size-4" /> Crear rutina
        </Link>
      </div>

      {/* Compartidas conmigo */}
      {shared.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
            <Share2 className="size-4" /> Compartidas conmigo
          </h2>
          <div className="stagger space-y-2.5">
            {shared.map((s) =>
              s.routine ? (
                <LinkTile
                  key={s.id}
                  href={`/rutinas/${s.routine.id}`}
                  title={s.routine.name}
                  subtitle={
                    s.routine.owner
                      ? `Coach: ${s.routine.owner.first_name} ${s.routine.owner.last_name}`
                      : "Compartida"
                  }
                  icon={Dumbbell}
                  accent
                />
              ) : null,
            )}
          </div>
        </section>
      )}

      {/* Mis rutinas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Mis rutinas
          </h2>
          <NewFolderButton />
        </div>

        {/* Carpetas */}
        {folders.map((folder) => {
          const items = byFolder(folder.id);
          return (
            <div key={folder.id} className="space-y-2.5">
              <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-semibold tracking-wide uppercase">
                <FolderIcon className="size-3.5" />
                <span className="flex-1 truncate">{folder.name}</span>
                <span>{items.length}</span>
                <FolderActions folderId={folder.id} folderName={folder.name} />
              </div>
              {items.length > 0 ? (
                <div className="stagger space-y-2.5">
                  {items.map((r) => (
                    <LinkTile
                      key={r.id}
                      href={`/rutinas/${r.id}`}
                      title={r.name}
                      icon={Dumbbell}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground px-1 text-sm">
                  Carpeta vacía.
                </p>
              )}
            </div>
          );
        })}

        {/* Rutinas en la raíz */}
        {rootRoutines.length > 0 && (
          <div className="stagger space-y-2.5">
            {rootRoutines.map((r) => (
              <LinkTile
                key={r.id}
                href={`/rutinas/${r.id}`}
                title={r.name}
                icon={Dumbbell}
              />
            ))}
          </div>
        )}

        {folders.length === 0 && rootRoutines.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Todavía no tenés rutinas.
            </p>
            <Link
              href="/rutinas/crear"
              className={cn(buttonVariants(), "mt-4")}
            >
              <Plus className="size-4" /> Crear mi primera rutina
            </Link>
          </Card>
        )}
      </section>
    </div>
  );
}
