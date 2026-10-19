import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

type IconName = ComponentProps<typeof Ionicons>["name"];

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color as string} />;
  };

/** Navegación principal (mismas secciones que el menú de la web). */
export default function TabsLayout() {
  const { profile } = useAuth();
  const isCoach = profile?.is_coach ?? false;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.heading, fontSize: 22 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen
        name="rutinas"
        options={{ title: "Rutinas", tabBarIcon: icon("barbell-outline") }}
      />
      <Tabs.Screen
        name="progreso"
        options={{ title: "Progreso", tabBarIcon: icon("trending-up-outline") }}
      />
      <Tabs.Screen
        name="alumnos"
        options={{
          title: "Alumnos",
          tabBarIcon: icon("people-outline"),
          href: isCoach ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: "Perfil", tabBarIcon: icon("person-outline") }}
      />
    </Tabs>
  );
}
