import { useEffect, useState } from "react";

import { getFolders, type FolderLite } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { RoutineBuilder } from "@/components/routine-builder";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

export default function CrearRutinaScreen() {
  const { session, profile } = useAuth();
  const [folders, setFolders] = useState<FolderLite[] | null>(null);

  useEffect(() => {
    if (session) getFolders(supabase, session.user.id).then(setFolders);
  }, [session]);

  if (!folders) return <Loading />;
  return <RoutineBuilder folders={folders} isCoach={profile?.is_coach ?? false} />;
}
