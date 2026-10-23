import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import type { CatalogEntry } from "@brabus/shared";
import {
  getCatalog,
  getFolders,
  getRoutineForEdit,
  type EditableRoutine,
  type FolderLite,
} from "@brabus/supabase";

import { Loading, NotFound } from "@/components/loading";
import { RoutineBuilder } from "@/components/routine-builder";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

export default function EditarRutinaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const [data, setData] = useState<
    | {
        routine: EditableRoutine | null;
        folders: FolderLite[];
        catalog: CatalogEntry[];
      }
    | undefined
  >(undefined);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      getRoutineForEdit(supabase, id, session.user.id),
      getFolders(supabase, session.user.id),
      getCatalog(supabase, session.user.id),
    ]).then(([routine, folders, catalog]) =>
      setData({ routine, folders, catalog }),
    );
  }, [id, session]);

  if (!data) return <Loading />;
  // Solo el dueño puede editar.
  if (!data.routine) return <NotFound text="No se encontró la rutina." />;

  return (
    <RoutineBuilder
      folders={data.folders}
      catalog={data.catalog}
      isCoach={profile?.is_coach ?? false}
      initial={data.routine}
    />
  );
}
