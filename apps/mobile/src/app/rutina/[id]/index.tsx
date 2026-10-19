import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import type { Routine } from "@brabus/shared";
import {
  deleteRoutine,
  getRoutineDetail,
  getRoutineShares,
  type RoutineDayLite,
} from "@brabus/supabase";

import { Loading, NotFound } from "@/components/loading";
import { Tile } from "@/components/tile";
import { Button, Card, Muted, SectionLabel, Title } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type Detail = { routine: Routine; days: RoutineDayLite[]; shareCount: number };

export default function RutinaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const d = await getRoutineDetail(supabase, id);
        if (!d) return setDetail(null);
        const canShare = d.routine.owner_id === session?.user.id && profile?.is_coach;
        const shares = canShare ? await getRoutineShares(supabase, id) : [];
        setDetail({ ...d, shareCount: shares.length });
      })();
    }, [id, session, profile?.is_coach]),
  );

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró la rutina." />;

  const { routine, days, shareCount } = detail;
  const isOwner = routine.owner_id === session?.user.id;
  const canShare = isOwner && (profile?.is_coach ?? false);

  const onDelete = () =>
    confirm({
      title: "Eliminar rutina",
      message: `Se eliminará «${routine.name}» y todos sus días y ejercicios. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      destructive: true,
      onConfirm: async () => {
        setDeleting(true);
        const result = await deleteRoutine(supabase, id);
        setDeleting(false);
        if (!result.ok) return notify("No se pudo eliminar", result.error);
        router.back();
      },
    });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "" }} />
      <View style={{ gap: 4 }}>
        <Title>{routine.name}</Title>
        {!isOwner ? <Muted>Rutina compartida por tu coach.</Muted> : null}
      </View>

      {isOwner ? (
        <View style={styles.actions}>
          <Button
            title="Editar"
            variant="outline"
            style={styles.action}
            onPress={() => router.push(`/rutina/${id}/editar`)}
            icon={<Ionicons name="create-outline" size={18} color={colors.foreground} />}
          />
          {canShare ? (
            <Button
              title={shareCount > 0 ? `Compartir (${shareCount})` : "Compartir"}
              variant="outline"
              style={styles.action}
              onPress={() => router.push(`/rutina/${id}/compartir`)}
              icon={<Ionicons name="share-social-outline" size={18} color={colors.foreground} />}
            />
          ) : null}
          <Button
            title="Eliminar"
            variant="destructive"
            style={styles.action}
            onPress={onDelete}
            loading={deleting}
            icon={<Ionicons name="trash-outline" size={18} color={colors.destructive} />}
          />
        </View>
      ) : null}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  section: { gap: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 40, paddingHorizontal: 14, flexGrow: 1 },
});
