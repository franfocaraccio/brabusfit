import { useEffect, useState } from "react";

import type { CatalogEntry } from "@brabus/shared";
import { getCatalog, getFolders, type FolderLite } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { RoutineBuilder } from "@/components/routine-builder";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

export default function CrearRutinaScreen() {
  const { session, profile } = useAuth();
  const [data, setData] = useState<{ folders: FolderLite[]; catalog: CatalogEntry[] } | null>(
    null,
  );

  useEffect(() => {
    if (!session) return;
    Promise.all([
      getFolders(supabase, session.user.id),
      getCatalog(supabase, session.user.id),
    ]).then(([folders, catalog]) => setData({ folders, catalog }));
  }, [session]);

  if (!data) return <Loading />;
  return (
    <RoutineBuilder
      folders={data.folders}
      catalog={data.catalog}
      isCoach={profile?.is_coach ?? false}
    />
  );
}
