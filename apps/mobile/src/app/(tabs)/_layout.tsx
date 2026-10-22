import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, type ComponentProps } from "react";
import { Alert, Platform, type ColorValue } from "react-native";

import { respondInvitation, type MyCoach } from "@brabus/supabase";

import { notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";
import { useCoaches } from "@/providers/coaches";

type IconName = ComponentProps<typeof Ionicons>["name"];

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color as string} />;
  };

// Invitaciones ya mostradas en esta apertura de la app ("Ahora no").
const shownThisLaunch = new Set<string>();

/** Navegación principal (mismas secciones que el menú de la web). */
export default function TabsLayout() {
  const { profile } = useAuth();
  const { pending, refresh } = useCoaches();
  const isCoach = profile?.is_coach ?? false;

  // Popup al abrir la app con una invitación pendiente de un coach.
  useEffect(() => {
    const next = pending.find((c) => !shownThisLaunch.has(c.linkId));
    if (!next) return;
    shownThisLaunch.add(next.linkId);
    askInvitation(next, refresh);
  }, [pending, refresh]);

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
      <Tabs.Screen
        name="index"
        // Sin barra de título: el saludo ya hace de encabezado.
        options={{
          title: "Inicio",
          headerShown: false,
          tabBarIcon: icon("home-outline"),
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          tabBarIcon: icon("people-outline"),
          href: isCoach ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="rutinas"
        // Alumno: "Entrenamiento" (rutinas y progreso), con etiqueta corta abajo.
        // Coach: solo administra rutinas de sus clientes, no entrena.
        options={{
          title: isCoach ? "Rutinas" : "Entrenamiento",
          tabBarLabel: isCoach ? "Rutinas" : "Entreno",
          tabBarIcon: icon("barbell-outline"),
        }}
      />
      <Tabs.Screen
        name="nutricion"
        options={{ title: "Nutrición", tabBarIcon: icon("nutrition-outline") }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: icon("person-outline"),
          // Invitaciones de coaches sin responder.
          tabBarBadge: pending.length > 0 ? pending.length : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
          },
        }}
      />
    </Tabs>
  );
}

function askInvitation(invite: MyCoach, refresh: () => Promise<void>) {
  const respond = async (accept: boolean) => {
    const result = await respondInvitation(supabase, invite.linkId, accept);
    if (!result.ok) return notify("No se pudo responder", result.error);
    await refresh();
    if (accept)
      notify(
        `Ahora entrenás con ${invite.name}`,
        "Ya podés ver todo lo que te comparta.",
      );
  };

  const title = "Te invitaron a un grupo de entrenamiento";
  const message = `${invite.name}${invite.username ? ` (@${invite.username})` : ""} te agregó como alumno. Si aceptás, vas a ver todo lo que te comparta y va a poder seguir tu progreso.`;

  if (Platform.OS === "web") {
    // Navegador (pruebas locales): Aceptar = OK, "Ahora no" = Cancelar.
    if (window.confirm(`${title}\n\n${message}\n\n¿Aceptar?`)) respond(true);
    return;
  }
  Alert.alert(
    title,
    message,
    [
      { text: "Ahora no", style: "cancel" },
      { text: "Rechazar", style: "destructive", onPress: () => respond(false) },
      { text: "Aceptar", onPress: () => respond(true) },
    ],
    { cancelable: false },
  );
}
