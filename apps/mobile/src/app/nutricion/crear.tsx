import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import {
  getClients,
  getNutritionFolders,
  type ClientSummary,
  type FolderLite,
} from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { PlanBuilder } from "@/components/plan-builder";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

export default function CrearPlanScreen() {
  // ?cliente=<id>: viene de la ficha del cliente ("Nuevo plan" → desde cero).
  const { cliente } = useLocalSearchParams<{ cliente?: string }>();
  const { session, profile } = useAuth();
  const isCoach = profile?.is_coach ?? false;
  const [data, setData] = useState<{
    folders: FolderLite[];
    clients: ClientSummary[];
  } | null>(null);

  useEffect(() => {
    // Espera al perfil: el builder toma clientes y rol solo al montarse.
    if (!session || !profile) return;
    Promise.all([
      getNutritionFolders(supabase, session.user.id),
      isCoach ? getClients(supabase, session.user.id) : Promise.resolve([]),
    ]).then(([folders, clients]) =>
      setData({ folders, clients: clients.filter((c) => !c.archived) }),
    );
  }, [session, profile, isCoach]);

  if (!data) return <Loading />;
  return (
    <PlanBuilder
      folders={data.folders}
      clients={data.clients}
      initialClientId={cliente}
    />
  );
}
