import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import type { CatalogEntry } from "@brabus/shared";
import {
  getCatalog,
  getFolders,
  getStudents,
  type FolderLite,
  type StudentSummary,
} from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { RoutineBuilder } from "@/components/routine-builder";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

export default function CrearRutinaScreen() {
  // ?alumno=<linkId>: viene de la pantalla del alumno ("Nueva rutina" → desde cero).
  const { alumno } = useLocalSearchParams<{ alumno?: string }>();
  const { session, profile } = useAuth();
  const isCoach = profile?.is_coach ?? false;
  const [data, setData] = useState<{
    folders: FolderLite[];
    catalog: CatalogEntry[];
    students: StudentSummary[];
  } | null>(null);

  useEffect(() => {
    // Espera al perfil: el builder toma alumnos y rol solo al montarse.
    if (!session || !profile) return;
    Promise.all([
      getFolders(supabase, session.user.id),
      getCatalog(supabase, session.user.id),
      isCoach ? getStudents(supabase, session.user.id) : Promise.resolve([]),
    ]).then(([folders, catalog, students]) => setData({ folders, catalog, students }));
  }, [session, profile, isCoach]);

  if (!data) return <Loading />;
  return (
    <RoutineBuilder
      folders={data.folders}
      catalog={data.catalog}
      isCoach={isCoach}
      students={data.students}
      initialStudentLinkId={alumno}
    />
  );
}
