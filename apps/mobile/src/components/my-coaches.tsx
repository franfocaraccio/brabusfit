import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { leaveCoach, respondInvitation, type MyCoach } from "@brabus/supabase";

import { Button, Card, Muted, SectionLabel } from "@/components/ui";
import { confirm, notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useCoaches } from "@/providers/coaches";

/** Perfil del alumno: invitaciones pendientes y coaches (igual que la web). */
export function MyCoaches() {
  const { coaches, refresh } = useCoaches();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (c: MyCoach, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(c.linkId);
    const result = await fn();
    setBusy(null);
    if (!result.ok) return notify("No se pudo completar", result.error);
    await refresh();
  };

  const onLeave = (c: MyCoach) =>
    confirm({
      title: `Desvincularte de ${c.name}`,
      message: `Vas a dejar de ver todo lo que ${c.name} te compartió y no va a poder seguir tu progreso. Tus entrenamientos guardados siguen siendo tuyos.`,
      confirmText: "Desvincularme",
      destructive: true,
      onConfirm: () => run(c, () => leaveCoach(supabase, c.linkId)),
    });

  return (
    <Card style={styles.card}>
      <SectionLabel>Mis coaches</SectionLabel>
      {coaches.length === 0 ? (
        <Muted>Todavía no entrenás con ningún coach. Cuando uno te agregue, vas a ver la invitación acá.</Muted>
      ) : (
        coaches.map((c, i) => (
          <View key={c.linkId} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.meta}>
                {c.username ? `@${c.username} · ` : ""}
                {c.status === "pending" ? "Te invitó a su grupo" : "Tu coach"}
              </Text>
            </View>
            {c.status === "pending" ? (
              <View style={styles.actions}>
                <Button
                  title="Rechazar"
                  variant="outline"
                  style={styles.small}
                  disabled={busy !== null}
                  onPress={() => run(c, () => respondInvitation(supabase, c.linkId, false))}
                />
                <Button
                  title="Aceptar"
                  style={styles.small}
                  loading={busy === c.linkId}
                  disabled={busy !== null}
                  onPress={() => run(c, () => respondInvitation(supabase, c.linkId, true))}
                />
              </View>
            ) : (
              <Button
                title="Desvincular"
                variant="ghost"
                style={styles.small}
                disabled={busy !== null}
                onPress={() => onLeave(c)}
              />
            )}
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  actions: { flexDirection: "row", gap: 6 },
  small: { minHeight: 36, paddingHorizontal: 12 },
});
