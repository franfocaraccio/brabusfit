import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { longDate } from "@brabus/shared";
import {
  getCoachHome,
  getStudentHome,
  type CoachHome as CoachHomeData,
  type StudentHome as StudentHomeData,
} from "@brabus/supabase";

import { CoachHome } from "@/components/coach-home";
import { StudentHome } from "@/components/student-home";
import { Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fonts, makeStyles, useColors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";
import { useCoaches } from "@/providers/coaches";

/** Inicio (igual que /dashboard en la web): métricas del alumno o panel del coach. */
export default function InicioScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { session, profile } = useAuth();
  const { pending } = useCoaches();
  const isCoach = profile?.is_coach ?? false;
  const [home, setHome] = useState<StudentHomeData | null>(null);
  const [coachHome, setCoachHome] = useState<CoachHomeData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    if (!session || !profile) return;
    if (profile.is_coach)
      setCoachHome(await getCoachHome(supabase, session.user.id));
    else setHome(await getStudentHome(supabase, session.user.id));
  }, [session, profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
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
      <View style={{ gap: 4 }}>
        <Text style={styles.greeting}>Hola, {profile?.first_name}</Text>
        <Muted>{longDate()}</Muted>
      </View>

      {pending.length > 0 ? (
        <Pressable
          onPress={() => router.push("/ajustes/coaches")}
          style={styles.banner}
          accessibilityRole="button"
        >
          <Ionicons name="mail-open-outline" size={20} color={colors.primaryText} />
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
          <StudentHome
            finishedAt={home.finishedAt}
            routine={home.routine}
            plan={home.plan}
          />
        ) : null
      ) : coachHome ? (
        <CoachHome data={coachHome} />
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
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
}));
