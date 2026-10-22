import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState, type ComponentProps } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { longDate } from "@brabus/shared";
import {
  getStudentHome,
  type StudentHome as StudentHomeData,
} from "@brabus/supabase";

import { StudentHome } from "@/components/student-home";
import { Tile } from "@/components/tile";
import { Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";
import { useCoaches } from "@/providers/coaches";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Inicio (igual que /dashboard en la web): métricas para el alumno, accesos para el coach. */
export default function InicioScreen() {
  const { session, profile } = useAuth();
  const { pending } = useCoaches();
  const isCoach = profile?.is_coach ?? false;
  const [home, setHome] = useState<StudentHomeData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (session && profile && !profile.is_coach) {
      setHome(await getStudentHome(supabase, session.user.id));
    }
  }, [session, profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const tiles: {
    href: Href;
    title: string;
    subtitle: string;
    icon: IconName;
    accent?: boolean;
  }[] = [
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
    {
      href: "/nutricion" as Href,
      title: "Nutrición",
      subtitle: isCoach ? "Planes de alimentación" : "Tu plan de alimentación",
      icon: "nutrition",
    },
    ...(isCoach
      ? [
          {
            href: "/clientes" as Href,
            title: "Clientes",
            subtitle: "Fichas, rutinas y progreso de tus clientes",
            icon: "people" as IconName,
          },
        ]
      : []),
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        isCoach ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        )
      }
    >
      <View style={{ gap: 4 }}>
        <Text style={styles.greeting}>Hola, {profile?.first_name}</Text>
        <Muted>
          {isCoach ? "Armales rutinas a tus clientes." : longDate()}
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
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      ) : null}

      {!isCoach ? (
        home ? (
          <StudentHome finishedAt={home.finishedAt} routine={home.routine} plan={home.plan} />
        ) : null
      ) : (
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
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  greeting: {
    fontFamily: fonts.heading,
    fontSize: 30,
    color: colors.foreground,
  },
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
  bannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.foreground,
  },
});
