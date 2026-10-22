import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui";
import { confirm } from "@/lib/confirm";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";
import { useCoaches } from "@/providers/coaches";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Ajustes (igual que /ajustes en la web): perfil, coaches, apariencia y salir. */
export default function AjustesScreen() {
  const { session, profile, signOut } = useAuth();
  const { pending } = useCoaches();
  const isCoach = profile?.is_coach ?? false;
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase();

  const onSignOut = () =>
    confirm({
      title: "Cerrar sesión",
      message: "¿Querés salir de tu cuenta?",
      confirmText: "Salir",
      destructive: true,
      onConfirm: signOut,
    });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => router.push("/ajustes/perfil")}
        style={({ pressed }) => pressed && { opacity: 0.7 }}
        accessibilityRole="button"
      >
        <Card style={styles.account}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {profile?.username ? `@${profile.username} · ` : ""}
              {session?.user.email}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.mutedForeground}
          />
        </Card>
      </Pressable>

      <Card style={styles.list}>
        <SettingsRow
          icon="person-outline"
          label="Mi perfil"
          href="/ajustes/perfil"
        />
        {!isCoach ? (
          <SettingsRow
            icon="people-outline"
            label="Mis coaches"
            href="/ajustes/coaches"
            badge={pending.length}
          />
        ) : null}
        <SettingsRow icon="color-palette-outline" label="Apariencia" soon />
      </Card>

      <Card style={styles.list}>
        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={colors.destructive}
          />
          <Text style={[styles.rowLabel, { color: colors.destructive }]}>
            Cerrar sesión
          </Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

function SettingsRow({
  icon,
  label,
  href,
  badge = 0,
  soon,
}: {
  icon: IconName;
  label: string;
  href?: Href;
  badge?: number;
  /** Todavía no disponible: se muestra apagada. */
  soon?: boolean;
}) {
  return (
    <Pressable
      onPress={href ? () => router.push(href) : undefined}
      disabled={!href}
      style={({ pressed }) => [
        styles.row,
        styles.rowBorder,
        pressed && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
    >
      <Ionicons
        name={icon}
        size={20}
        color={soon ? colors.mutedForeground : colors.primary}
      />
      <Text
        style={[styles.rowLabel, soon && { color: colors.mutedForeground }]}
      >
        {label}
      </Text>
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {soon ? (
        <Text style={styles.soon}>Próximamente</Text>
      ) : (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.mutedForeground}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  account: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,115,22,0.15)",
  },
  avatarText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.primary,
  },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  list: { paddingVertical: 0, paddingHorizontal: 0, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.foreground,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primaryForeground,
  },
  soon: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
});
