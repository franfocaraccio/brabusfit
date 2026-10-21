import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import type { CatalogEntry } from "@brabus/shared";
import {
  getCatalog,
  getClients,
  getFolders,
  type ClientSummary,
  type FolderLite,
} from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { RoutineBuilder } from "@/components/routine-builder";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

export default function CrearRutinaScreen() {
  // ?cliente=<id>: viene de la ficha del cliente ("Nueva rutina" → desde cero).
  const { cliente } = useLocalSearchParams<{ cliente?: string }>();
  const { session, profile } = useAuth();
  const isCoach = profile?.is_coach ?? false;
  const [data, setData] = useState<{
    folders: FolderLite[];
    catalog: CatalogEntry[];
    clients: ClientSummary[];
  } | null>(null);

  useEffect(() => {
    // Espera al perfil: el builder toma clientes y rol solo al montarse.
    if (!session || !profile) return;
    Promise.all([
      getFolders(supabase, session.user.id),
      getCatalog(supabase, session.user.id),
      isCoach ? getClients(supabase, session.user.id) : Promise.resolve([]),
    ]).then(([folders, catalog, clients]) =>
      setData({ folders, catalog, clients: clients.filter((c) => !c.archived) }),
    );
  }, [session, profile, isCoach]);

  if (!data) return <Loading />;
  return (
    <RoutineBuilder
      folders={data.folders}
      catalog={data.catalog}
      isCoach={isCoach}
      clients={data.clients}
      initialClientId={cliente}
    />
  );
}
