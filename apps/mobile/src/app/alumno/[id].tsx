import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatSessionDate, summarizeHistory, type ProgressSession } from "@brabus/shared";
import {
  getProgressSessions,
  getStudentDetail,
  visibleLogs,
  type StudentSession,
} from "@brabus/supabase";

import { Loading, NotFound } from "@/components/loading";
import { ProgressView } from "@/components/progress-view";
import { Segmented } from "@/components/segmented";
import { Card, Muted, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";

type Tab = "progreso" | "entrenamientos";

/** Alumno: progreso y últimos entrenamientos (igual que /alumnos/[id] en la web). */
export default function AlumnoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("progreso");
  const [detail, setDetail] = useState<
    { name: string; sessions: StudentSession[] } | null | undefined
  >(undefined);
  const [progress, setProgress] = useState<ProgressSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getStudentDetail(supabase, id), getProgressSessions(supabase, id)]).then(
        ([d, p]) => {
          setDetail(d);
          setProgress(p);
        },
      );
    }, [id]),
  );

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró el alumno." />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "" }} />
      <Title>{detail.name}</Title>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "progreso", label: "Progreso" },
          { value: "entrenamientos", label: "Entrenamientos" },
        ]}
      />

      {tab === "progreso" ? (
        <ProgressView
          sessions={progress}
          emptyText="Este alumno todavía no registró entrenamientos en tus rutinas."
        />
      ) : detail.sessions.length === 0 ? (
        <Card style={{ padding: 20 }}>
          <Muted style={{ textAlign: "center" }}>
            Este alumno todavía no registró entrenamientos.
          </Muted>
        </Card>
      ) : (
        detail.sessions.map((s) => {
          const logs = visibleLogs(s);
          return (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/sesion/${s.id}`)}
              accessibilityRole="button"
            >
              <Card style={styles.session}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionTitle} numberOfLines={2}>
                    {s.routine?.name} · {s.day?.name}
                  </Text>
                  <Text style={styles.sessionDate}>
                    {formatSessionDate(s.finished_at ?? s.started_at)}
                  </Text>
                </View>
                {logs.length === 0 ? (
                  <Muted style={{ fontSize: 13 }}>Sin series registradas.</Muted>
                ) : (
                  logs.map((l, i) => (
                    <Text key={i} style={styles.exercise}>
                      {l.exercise?.name ?? "Ejercicio"}
                      <Text style={styles.sets}>
                        {"  "}
                        {summarizeHistory({
                          sets: [...l.set_logs].sort((a, b) => a.set_number - b.set_number),
                          note: l.note,
                        })}
                      </Text>
                    </Text>
                  ))
                )}
              </Card>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  session: { padding: 14, gap: 10 },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  sessionTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  sessionDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  exercise: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  sets: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
});
