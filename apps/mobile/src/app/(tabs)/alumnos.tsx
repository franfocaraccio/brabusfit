import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatDate } from "@brabus/shared";
import { getStudents, type StudentSummary } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { Card, Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";

/** Alumnos del coach (igual que /alumnos en la web). */
export default function AlumnosScreen() {
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setStudents(await getStudents(supabase));
  }, []);

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
      <Muted>Seguí el progreso de tus alumnos.</Muted>

      {students.length === 0 ? (
        <Card style={styles.empty}>
          <Ionicons name="people-outline" size={32} color={colors.mutedForeground} />
          <Muted style={{ textAlign: "center" }}>
            Todavía no compartiste rutinas con ningún alumno con cuenta activa.
          </Muted>
        </Card>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          {students.map((st, i) => (
            <Pressable
              key={st.id}
              onPress={() => router.push(`/alumno/${st.id}`)}
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
                <Text style={styles.name} numberOfLines={1}>
                  {st.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {st.routines.length} rutina(s) ·{" "}
                  {st.lastActivity
                    ? `última actividad ${formatDate(st.lastActivity)}`
                    : "sin entrenamientos aún"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </Card>
      )}
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
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
});
