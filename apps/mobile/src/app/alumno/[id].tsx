import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatSessionDate, summarizeHistory, type ProgressSession } from "@brabus/shared";
import {
  copyRoutine,
  getProgressSessions,
  getRoutinesOverview,
  getStudentDetail,
  visibleLogs,
  type FolderLite,
  type RoutineLite,
  type StudentDetail,
} from "@brabus/supabase";

import { Loading, NotFound } from "@/components/loading";
import { ProgressView } from "@/components/progress-view";
import { Segmented } from "@/components/segmented";
import { Sheet } from "@/components/sheet";
import { UnlinkStudentSheet } from "@/components/students";
import { Tile } from "@/components/tile";
import { Button, Card, Muted, Title } from "@/components/ui";
import { notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type Tab = "progreso" | "entrenamientos" | "rutinas";

/** Alumno: progreso, entrenamientos y sus rutinas (igual que /alumnos/[id] en la web). */
export default function AlumnoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("progreso");
  const [detail, setDetail] = useState<StudentDetail | null | undefined>(undefined);
  const [progress, setProgress] = useState<ProgressSession[]>([]);
  const [unlinking, setUnlinking] = useState(false);
  const [templates, setTemplates] = useState<{ folders: FolderLite[]; routines: RoutineLite[] }>({
    folders: [],
    routines: [],
  });
  const [newSheet, setNewSheet] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      Promise.all([
        getStudentDetail(supabase, session.user.id, id),
        getProgressSessions(supabase, id),
        getRoutinesOverview(supabase, session.user.id),
      ]).then(([d, p, o]) => {
        setDetail(d);
        setProgress(p);
        setTemplates({ folders: o.folders, routines: o.routines });
      });
    }, [id, session]),
  );

  const fromTemplate = async (templateId: string) => {
    if (!detail) return;
    setCopying(templateId);
    const result = await copyRoutine(supabase, templateId, detail.link.id);
    setCopying(null);
    if (!result.ok) return notify("No se pudo crear", result.error);
    setNewSheet(false);
    router.push(`/rutina/${result.data.id}`);
  };

  const templateGroups = [
    ...templates.folders.map((f) => ({
      id: f.id,
      name: f.name,
      items: templates.routines.filter((r) => r.folder_id === f.id),
    })),
    { id: "__root__", name: "Sin carpeta", items: templates.routines.filter((r) => !r.folder_id) },
  ].filter((g) => g.items.length > 0);

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
            Ya podés armarle rutinas: las va a ver cuando acepte. Su progreso aparece después
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
        <>
          <Button
            title="Nueva rutina"
            onPress={() => setNewSheet(true)}
            icon={<Ionicons name="add" size={18} color={colors.primaryForeground} />}
          />
          {detail.routines.length === 0 ? (
            <Card style={{ padding: 20 }}>
              <Muted style={{ textAlign: "center" }}>
                Todavía no le armaste rutinas. Creale una desde cero o a partir de una plantilla.
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
          )}
        </>
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

      <Sheet
        visible={newSheet}
        onClose={() => setNewSheet(false)}
        title={`Nueva rutina para ${detail.name}`}
        description="Armala desde cero o partí de una de tus plantillas (se crea una copia propia del alumno)."
      >
        <Button
          title="Desde cero"
          variant="outline"
          onPress={() => {
            setNewSheet(false);
            router.push(`/rutina/crear?alumno=${detail.link.id}`);
          }}
          icon={<Ionicons name="create-outline" size={18} color={colors.foreground} />}
        />
        {templateGroups.length === 0 ? (
          <Muted style={{ fontSize: 13 }}>
            Todavía no tenés plantillas. Las plantillas se crean desde Rutinas.
          </Muted>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 12 }}>
            <Muted style={{ fontSize: 13 }}>Desde una plantilla</Muted>
            {templateGroups.map((g) => (
              <View key={g.id} style={{ gap: 6 }}>
                <Text style={styles.groupName}>{g.name}</Text>
                <View style={styles.templateList}>
                  {g.items.map((t, i) => (
                    <Pressable
                      key={t.id}
                      onPress={() => fromTemplate(t.id)}
                      disabled={copying !== null}
                      style={[styles.templateRow, i > 0 && styles.templateBorder]}
                      accessibilityRole="button"
                    >
                      <Ionicons name="barbell-outline" size={18} color={colors.mutedForeground} />
                      <Text style={styles.templateName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      {copying === t.id ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <Ionicons name="copy-outline" size={18} color={colors.mutedForeground} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </Sheet>

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
  groupName: { fontFamily: fonts.medium, fontSize: 12, color: colors.mutedForeground },
  templateList: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  templateRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  templateBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  templateName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.foreground },
});
