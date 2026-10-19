import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { formatSessionDate, summarizeSets } from "@brabus/shared";
import { getStudentDetail, visibleLogs, type StudentSession } from "@brabus/supabase";

import { Loading, NotFound } from "@/components/loading";
import { Card, Muted, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";

/** Últimos entrenamientos de un alumno (igual que /alumnos/[id] en la web). */
export default function AlumnoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<
    { name: string; sessions: StudentSession[] } | null | undefined
  >(undefined);

  useEffect(() => {
    getStudentDetail(supabase, id).then(setDetail);
  }, [id]);

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró el alumno." />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "" }} />
      <View style={{ gap: 4 }}>
        <Title>{detail.name}</Title>
        <Muted>Últimos entrenamientos registrados.</Muted>
      </View>

      {detail.sessions.length === 0 ? (
        <Card style={{ padding: 20 }}>
          <Muted style={{ textAlign: "center" }}>
            Este alumno todavía no registró entrenamientos.
          </Muted>
        </Card>
      ) : (
        detail.sessions.map((s) => {
          const logs = visibleLogs(s);
          return (
            <Card key={s.id} style={styles.session}>
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
                  <View key={i} style={{ gap: 2 }}>
                    <Text style={styles.exercise}>
                      {l.exercise?.name ?? "Ejercicio"}
                      <Text style={styles.sets}>
                        {"  "}
                        {summarizeSets([...l.set_logs].sort((a, b) => a.set_number - b.set_number))}
                      </Text>
                    </Text>
                    {l.note ? <Text style={styles.note}>“{l.note}”</Text> : null}
                  </View>
                ))
              )}
            </Card>
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
  note: { fontFamily: fonts.regular, fontStyle: "italic", fontSize: 13, color: colors.mutedForeground },
});
