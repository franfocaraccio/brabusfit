import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatSessionDate, summarizeHistory, type ProgressSession } from "@brabus/shared";
import {
  getProgressSessions,
  getStudentDetail,
  visibleLogs,
  type StudentDetail,
} from "@brabus/supabase";

import { Loading, NotFound } from "@/components/loading";
import { ProgressView } from "@/components/progress-view";
import { Segmented } from "@/components/segmented";
import { UnlinkStudentSheet } from "@/components/students";
import { Tile } from "@/components/tile";
import { Card, Muted, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type Tab = "progreso" | "entrenamientos" | "rutinas";

/** Alumno: progreso, entrenamientos y rutinas compartidas (igual que /alumnos/[id] en la web). */
export default function AlumnoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("progreso");
  const [detail, setDetail] = useState<StudentDetail | null | undefined>(undefined);
  const [progress, setProgress] = useState<ProgressSession[]>([]);
  const [unlinking, setUnlinking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      Promise.all([
        getStudentDetail(supabase, session.user.id, id),
        getProgressSessions(supabase, id),
      ]).then(([d, p]) => {
        setDetail(d);
        setProgress(p);
      });
    }, [id, session]),
  );

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró el alumno." />;
  const isPending = detail.link.status === "pending";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <Pressable onPress={() => setUnlinking(true)} hitSlop={10}>
              <Text style={styles.unlink}>{isPending ? "Cancelar invitación" : "Desvincular"}</Text>
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: 2 }}>
        <Title>{detail.name}</Title>
        <Muted style={{ fontSize: 13 }}>
          {detail.username ? `@${detail.username} · ` : ""}
          {detail.email}
        </Muted>
      </View>

      {isPending ? (
        <Card style={styles.pending}>
          <Text style={styles.pendingText}>
            <Text style={{ fontFamily: fonts.semibold }}>Invitación pendiente. </Text>
            Ya podés compartirle rutinas: las va a ver cuando acepte. Su progreso aparece después
            de aceptar.
          </Text>
        </Card>
      ) : null}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "progreso", label: "Progreso" },
          { value: "entrenamientos", label: "Entrenam." },
          { value: "rutinas", label: `Rutinas (${detail.routines.length})` },
        ]}
      />

      {tab === "rutinas" ? (
        detail.routines.length === 0 ? (
          <Card style={{ padding: 20 }}>
            <Muted style={{ textAlign: "center" }}>
              Todavía no le compartiste rutinas. Entrá a una rutina y tocá &quot;Compartir&quot;.
            </Muted>
          </Card>
        ) : (
          detail.routines.map((r) => (
            <Tile
              key={r.id}
              title={r.name}
              icon="barbell"
              onPress={() => router.push(`/rutina/${r.id}`)}
            />
          ))
        )
      ) : tab === "progreso" ? (
        <ProgressView
          sessions={progress}
          emptyText={
            isPending
              ? "Vas a ver su progreso cuando acepte la invitación."
              : "Este alumno todavía no registró entrenamientos en tus rutinas."
          }
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

      <UnlinkStudentSheet
        visible={unlinking}
        onClose={() => setUnlinking(false)}
        linkId={detail.link.id}
        name={detail.name}
        pending={isPending}
        routineCount={detail.routines.length}
        onDone={() => router.back()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  unlink: { fontFamily: fonts.medium, fontSize: 15, color: colors.destructive },
  pending: {
    padding: 14,
    borderColor: "rgba(245,158,11,0.4)",
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  pendingText: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  session: { padding: 14, gap: 10 },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  sessionTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  sessionDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  exercise: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  sets: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
});
