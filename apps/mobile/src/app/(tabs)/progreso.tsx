import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import type { ProgressSession } from "@brabus/shared";
import { getProgressSessions } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { ProgressView } from "@/components/progress-view";
import { Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** Progreso: evolución por ejercicio en todas las rutinas (igual que /progreso en la web). */
export default function ProgresoScreen() {
  const { session } = useAuth();
  const [sessions, setSessions] = useState<ProgressSession[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (session) setSessions(await getProgressSessions(supabase, session.user.id));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!sessions) return <Loading />;

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
      <Muted>Tu evolución por ejercicio, en todas tus rutinas.</Muted>
      <ProgressView sessions={sessions} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
});
