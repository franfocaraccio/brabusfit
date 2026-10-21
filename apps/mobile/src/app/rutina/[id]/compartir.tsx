import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getShareTargets, setRoutineShare, type ShareTarget } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { AddStudentSheet } from "@/components/students";
import { Button, Card, Muted } from "@/components/ui";
import { notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** Compartir una rutina eligiendo entre los alumnos (igual que la web). */
export default function CompartirScreen() {
  const { id: routineId } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [targets, setTargets] = useState<ShareTarget[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (session) setTargets(await getShareTargets(supabase, session.user.id, routineId));
  }, [session, routineId]);

  useEffect(() => {
    if (session) getShareTargets(supabase, session.user.id, routineId).then(setTargets);
  }, [session, routineId]);

  const toggle = async (t: ShareTarget) => {
    setBusy(t.linkId);
    const result = await setRoutineShare(supabase, routineId, t.linkId, !t.shared);
    setBusy(null);
    if (!result.ok) return notify("No se pudo compartir", result.error);
    Haptics.selectionAsync().catch(() => {});
    setTargets((list) =>
      list ? list.map((x) => (x.linkId === t.linkId ? { ...x, shared: !t.shared } : x)) : list,
    );
  };

  if (!targets) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Muted>
        Elegí con cuáles de tus alumnos compartirla. Los que tienen la invitación pendiente la van a
        ver cuando la acepten.
      </Muted>

      {targets.length === 0 ? (
        <Card style={{ padding: 20 }}>
          <Muted style={{ textAlign: "center" }}>Todavía no tenés alumnos.</Muted>
        </Card>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          {targets.map((t, i) => (
            <Pressable
              key={t.linkId}
              onPress={() => toggle(t)}
              disabled={busy !== null}
              style={[styles.row, i > 0 && styles.rowBorder]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: t.shared }}
            >
              <View style={[styles.box, t.shared && styles.boxOn]}>
                {t.shared ? (
                  <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {t.username ? `@${t.username}` : t.email}
                  {t.status === "pending" ? " · Invitación pendiente" : ""}
                </Text>
              </View>
              {busy === t.linkId ? <ActivityIndicator color={colors.primary} /> : null}
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
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm - 2,
    borderWidth: 1.5,
    borderColor: colors.mutedForeground,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
});
