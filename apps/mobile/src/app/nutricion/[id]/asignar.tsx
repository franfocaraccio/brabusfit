import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { APP_ACCESS_LABEL } from "@brabus/shared";
import { copyPlan, getClients, type ClientSummary } from "@brabus/supabase";

import { Loading } from "@/components/loading";
import { Button, Card, Muted } from "@/components/ui";
import { notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** Asignar una plantilla de nutrición a un cliente: le crea una copia propia. */
export default function AsignarPlanScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      getClients(supabase, session.user.id).then((list) =>
        setClients(list.filter((c) => !c.archived)),
      );
    }
  }, [session]);

  const assign = async (c: ClientSummary) => {
    setBusy(c.id);
    const result = await copyPlan(supabase, planId, c.id);
    setBusy(null);
    if (!result.ok) return notify("No se pudo asignar", result.error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace(`/nutricion/${result.data.id}`);
  };

  if (!clients) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Muted>
        Se le crea una copia propia de esta plantilla. Después podés ajustarla solo para ese
        cliente: los cambios no afectan a la plantilla ni a otros clientes.
      </Muted>

      {clients.length === 0 ? (
        <Card style={{ padding: 20 }}>
          <Muted style={{ textAlign: "center" }}>Todavía no tenés clientes.</Muted>
        </Card>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          {clients.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => assign(c)}
              disabled={busy !== null}
              style={[styles.row, i > 0 && styles.rowBorder]}
              accessibilityRole="button"
            >
              <Ionicons name="person-outline" size={20} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {APP_ACCESS_LABEL[c.appAccess]}
                </Text>
              </View>
              {busy === c.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              )}
            </Pressable>
          ))}
        </Card>
      )}

      <Button
        title="Nuevo cliente"
        variant="outline"
        onPress={() => router.push("/cliente/nuevo")}
        icon={<Ionicons name="person-add-outline" size={18} color={colors.foreground} />}
      />
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
