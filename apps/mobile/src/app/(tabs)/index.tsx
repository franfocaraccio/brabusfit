import { router, type Href } from "expo-router";
import type { ComponentProps } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Ionicons } from "@expo/vector-icons";

import { Tile } from "@/components/tile";
import { Muted } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Inicio: saludo + accesos (igual que /dashboard en la web). */
export default function InicioScreen() {
  const { profile } = useAuth();
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
});
