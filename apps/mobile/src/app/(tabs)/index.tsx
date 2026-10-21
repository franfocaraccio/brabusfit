import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Tile } from "@/components/tile";
import { Muted } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";
import { useCoaches } from "@/providers/coaches";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Inicio: saludo + accesos (igual que /dashboard en la web). */
export default function InicioScreen() {
  const { profile } = useAuth();
  const { pending } = useCoaches();
  const isCoach = profile?.is_coach ?? false;

  const tiles: { href: Href; title: string; subtitle: string; icon: IconName; accent?: boolean }[] = [
    {
      href: "/rutina/crear",
      title: "Crear rutina",
      subtitle: "Armá una rutina nueva",
      icon: "add",
      accent: true,
    },
    {
      href: "/rutinas",
      title: "Mis rutinas",
      subtitle: "Ver y entrenar tus rutinas",
      icon: "barbell",
    },
    ...(isCoach
      ? [
          {
            href: "/alumnos" as Href,
            title: "Alumnos",
            subtitle: "Seguí el progreso de tus alumnos",
            icon: "people" as IconName,
          },
        ]
      : []),
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={{ gap: 4 }}>
        <Text style={styles.greeting}>Hola, {profile?.first_name}</Text>
        <Muted>
          {isCoach
            ? "Creá rutinas y compartilas con tus alumnos."
            : "Elegí una rutina y empezá a entrenar."}
        </Muted>
      </View>

      {pending.length > 0 ? (
        <Pressable
          onPress={() => router.push("/perfil")}
          style={styles.banner}
          accessibilityRole="button"
        >
          <Ionicons name="mail-open-outline" size={20} color={colors.primary} />
          <Text style={styles.bannerText}>
            {pending.length === 1
              ? "Tenés 1 invitación pendiente de un coach"
              : `Tenés ${pending.length} invitaciones pendientes de coaches`}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      ) : null}

      <View style={{ gap: 10 }}>
        {tiles.map((t) => (
          <Tile
            key={t.title}
            title={t.title}
            subtitle={t.subtitle}
            icon={t.icon}
            accent={t.accent}
            onPress={() => router.push(t.href)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  greeting: { fontFamily: fonts.heading, fontSize: 30, color: colors.foreground },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.4)",
    backgroundColor: "rgba(249,115,22,0.1)",
  },
  bannerText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
});
