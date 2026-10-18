import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import type { Routine } from "@brabus/shared";
import { getRoutineDetail, type RoutineDayLite } from "@brabus/supabase";

import { Tile } from "@/components/tile";
import { Card, Muted, SectionLabel, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

export default function RutinaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [detail, setDetail] = useState<
    { routine: Routine; days: RoutineDayLite[] } | null | undefined
  >(undefined);

  useFocusEffect(
    useCallback(() => {
      getRoutineDetail(supabase, id).then(setDetail);
    }, [id]),
  );

  if (detail === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (detail === null) {
    return (
      <View style={styles.center}>
        <Muted>No se encontró la rutina.</Muted>
      </View>
    );
  }

  const { routine, days } = detail;
  const isOwner = routine.owner_id === session?.user.id;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "" }} />
      <View style={{ gap: 4 }}>
        <Title>{routine.name}</Title>
        {!isOwner ? <Muted>Rutina compartida por tu coach.</Muted> : null}
      </View>

      <View style={styles.section}>
        <SectionLabel>Elegí un día para entrenar</SectionLabel>
        {days.length > 0 ? (
          days.map((day, i) => (
            <Tile
              key={day.id}
              title={day.name}
              subtitle={`${day.exerciseCount} ejercicios`}
              chip={i + 1}
              accent
              onPress={() => router.push(`/rutina/${id}/dia/${day.id}`)}
            />
          ))
        ) : (
          <Card style={{ padding: 18 }}>
            <Muted>Esta rutina no tiene días.</Muted>
          </Card>
        )}
      </View>

      {isOwner ? (
        <Muted style={styles.hint}>
          Para editar o compartir esta rutina, usá la web.
        </Muted>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  section: { gap: 10 },
  hint: { textAlign: "center" },
});
