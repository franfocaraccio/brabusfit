import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { formatSessionDate } from "@brabus/shared";
import { getRoutineSessions, type SessionSummary } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { Tile } from "@/components/tile";
import { Card, Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** Entrenamientos guardados de una rutina (igual que /rutinas/[id]/historial). */
export default function HistorialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (session) {
        getRoutineSessions(supabase, { routineId: id, userId: session.user.id }).then(
          setSessions,
        );
      }
    }, [id, session]),
  );

  if (!sessions) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Muted>Tus entrenamientos guardados de esta rutina. Tocá uno para verlo o corregirlo.</Muted>
      {sessions.length === 0 ? (
        <Card style={styles.empty}>
          <Ionicons name="time-outline" size={32} color={colors.mutedForeground} />
          <Muted style={{ textAlign: "center" }}>
            Todavía no guardaste entrenamientos de esta rutina.
          </Muted>
        </Card>
      ) : (
        sessions.map((s) => (
          <Tile
            key={s.id}
            title={s.dayName}
            subtitle={`${formatSessionDate(s.date)} · ${s.exerciseCount} ${
              s.exerciseCount === 1 ? "ejercicio" : "ejercicios"
            }`}
            icon="time-outline"
            onPress={() => router.push(`/sesion/${s.id}`)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  empty: { padding: 24, alignItems: "center", gap: 10 },
});
