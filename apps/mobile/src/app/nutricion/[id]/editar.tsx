import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import {
  getNutritionFolders,
  getPlanDetail,
  planToInput,
  type FolderLite,
  type PlanDetail,
} from "@brabus/supabase";

import { Loading, NotFound } from "@/components/loading";
import { PlanBuilder } from "@/components/plan-builder";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

export default function EditarPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [data, setData] = useState<
    { detail: PlanDetail | null; folders: FolderLite[] } | undefined
  >(undefined);

  useEffect(() => {
    if (!session) return;
    Promise.all([getPlanDetail(supabase, id), getNutritionFolders(supabase, session.user.id)]).then(
      ([detail, folders]) => setData({ detail, folders }),
    );
  }, [id, session]);

  if (!data) return <Loading />;
  const { detail } = data;
  // Solo el dueño edita.
  if (!detail || detail.plan.owner_id !== session?.user.id) {
    return <NotFound text="No se encontró el plan." />;
  }

  return (
    <PlanBuilder
      planId={id}
      initial={planToInput(detail)}
      clientName={detail.plan.client_id ? (detail.client?.name ?? "Cliente") : null}
      folders={data.folders}
    />
  );
}
