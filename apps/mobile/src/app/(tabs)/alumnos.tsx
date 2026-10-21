import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatDate } from "@brabus/shared";
import { getStudents, type StudentSummary } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { AddStudentSheet, UnlinkStudentSheet } from "@/components/students";
import { Button, Card, Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

function subtitle(st: StudentSummary) {
  const routines = `${st.routineCount} ${st.routineCount === 1 ? "rutina" : "rutinas"}`;
  if (st.status === "pending") return `Invitación pendiente · ${routines}`;
  return `${routines} · ${
    st.lastActivity ? `última actividad ${formatDate(st.lastActivity)}` : "sin entrenamientos aún"
  }`;
}

/** Alumnos del coach (igual que /alumnos en la web). */
export default function AlumnosScreen() {
  const { session } = useAuth();
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<StudentSummary | null>(null);

  const load = useCallback(async () => {
    if (session) setStudents(await getStudents(supabase, session.user.id));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!students) return <Loading />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.primary}
        />
      }
    >
      <Muted>Tu grupo: seguí su progreso y armales sus rutinas.</Muted>
      <Button
        title="Agregar alumno"
        onPress={() => setAdding(true)}
        icon={<Ionicons name="person-add-outline" size={18} color={colors.primaryForeground} />}
      />

      {students.length === 0 ? (
        <Card style={styles.empty}>
          <Ionicons name="people-outline" size={32} color={colors.mutedForeground} />
          <Muted style={{ textAlign: "center" }}>
            Todavía no tenés alumnos. Agregalos por su usuario o email.
          </Muted>
        </Card>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          {students.map((st, i) => (
            <Pressable
              key={st.linkId}
              onPress={() =>
                st.studentId ? router.push(`/alumno/${st.studentId}`) : setCancelling(st)
              }
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowBorder,
                pressed && { backgroundColor: colors.muted },
              ]}
              accessibilityRole="button"
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{st.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {st.name}
                  </Text>
                  {st.status === "pending" ? <Text style={styles.badge}>Pendiente</Text> : null}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {st.username ? `@${st.username} · ` : ""}
                  {subtitle(st)}
                </Text>
              </View>
              <Ionicons
                name={st.studentId ? "chevron-forward" : "close-circle-outline"}
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          ))}
        </Card>
      )}

      <AddStudentSheet visible={adding} onClose={() => setAdding(false)} onAdded={load} />
      {cancelling ? (
        <UnlinkStudentSheet
          visible
          onClose={() => setCancelling(null)}
          linkId={cancelling.linkId}
          name={cancelling.email}
          pending
          routineCount={cancelling.routineCount}
          onDone={load}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  empty: { padding: 24, alignItems: "center", gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 16, color: colors.foreground },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  badge: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: "#f59e0b",
    backgroundColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
});
