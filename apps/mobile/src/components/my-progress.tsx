import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import type { ProgressSession } from "@brabus/shared";
import { getProgressSessions } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { ProgressView } from "@/components/progress-view";
import { Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { makeStyles, useColors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** Progreso: evolución por ejercicio en todas las rutinas (igual que /progreso en la web). */
export function MyProgress({ header }: { header?: ReactNode }) {
  const colors = useColors();
  const styles = useStyles();
  const { session } = useAuth();
  const [sessions, setSessions] = useState<ProgressSession[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (session)
      setSessions(await getProgressSessions(supabase, session.user.id));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!sessions) {
    return (
      <View style={styles.screen}>
        {header ? <View style={{ padding: 16 }}>{header}</View> : null}
        <Loading />
      </View>
    );
  }

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
      {header}
      <Muted>Tu evolución por ejercicio, en todas tus rutinas.</Muted>
      <ProgressView sessions={sessions} />
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
}));
