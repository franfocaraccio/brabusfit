import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { copyRoutine, getStudents, type StudentSummary } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { AddStudentSheet } from "@/components/students";
import { Button, Card, Muted } from "@/components/ui";
import { notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** Asignar una plantilla a un alumno: le crea una copia propia (igual que la web). */
export default function AsignarScreen() {
  const { id: routineId } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (session) setStudents(await getStudents(supabase, session.user.id));
  }, [session]);

  useEffect(() => {
    if (session) getStudents(supabase, session.user.id).then(setStudents);
  }, [session]);

  const assign = async (st: StudentSummary) => {
    setBusy(st.linkId);
    const result = await copyRoutine(supabase, routineId, st.linkId);
    setBusy(null);
    if (!result.ok) return notify("No se pudo asignar", result.error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace(`/rutina/${result.data.id}`);
  };

  if (!students) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Muted>
        Se le crea una copia propia de esta plantilla. Después podés ajustarla solo para ese
        alumno: los cambios no afectan a la plantilla ni a otros alumnos.
      </Muted>

      {students.length === 0 ? (
        <Card style={{ padding: 20 }}>
          <Muted style={{ textAlign: "center" }}>Todavía no tenés alumnos.</Muted>
        </Card>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          {students.map((st, i) => (
            <Pressable
              key={st.linkId}
              onPress={() => assign(st)}
              disabled={busy !== null}
              style={[styles.row, i > 0 && styles.rowBorder]}
              accessibilityRole="button"
            >
              <Ionicons name="person-outline" size={20} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {st.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {st.username ? `@${st.username}` : st.email}
                  {st.status === "pending" ? " · Invitación pendiente" : ""}
                  {` · ${st.routineCount} ${st.routineCount === 1 ? "rutina" : "rutinas"}`}
                </Text>
              </View>
              {busy === st.linkId ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              )}
            </Pressable>
          ))}
        </Card>
      )}

      <Button
        title="Agregar alumno"
        variant="outline"
        onPress={() => setAdding(true)}
        icon={<Ionicons name="person-add-outline" size={18} color={colors.foreground} />}
      />
      <AddStudentSheet visible={adding} onClose={() => setAdding(false)} onAdded={load} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
});
