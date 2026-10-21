import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  useFonts,
} from "@expo-google-fonts/barlow";
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from "@expo-google-fonts/barlow-condensed";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { colors, fonts } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/providers/auth";
import { CoachesProvider } from "@/providers/coaches";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

  return (
    <AuthProvider>
      <CoachesProvider>
        <StatusBar style="light" />
        <RootNavigator fontsLoaded={fontsLoaded} />
      </CoachesProvider>
    </AuthProvider>
  );
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { loading, session, profile } = useAuth();
  const ready = fontsLoaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = !!session;
  // Usuarios de Google que todavía no completaron su perfil.
  const onboarded = profile?.onboarded !== false;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.heading, fontSize: 20 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ title: "Crear cuenta" }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="completar-perfil" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="rutina/crear" options={{ title: "Crear rutina" }} />
        <Stack.Screen name="rutina/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="rutina/[id]/editar" options={{ title: "Editar rutina" }} />
        <Stack.Screen name="rutina/[id]/asignar" options={{ title: "Asignar a cliente" }} />
        <Stack.Screen name="rutina/[id]/dia/[dayId]" options={{ title: "" }} />
        <Stack.Screen name="rutina/[id]/historial" options={{ title: "Historial" }} />
        <Stack.Screen name="sesion/[id]" options={{ title: "Sesión" }} />
        <Stack.Screen name="cliente/nuevo" options={{ title: "Nuevo cliente" }} />
        <Stack.Screen name="cliente/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="cliente/[id]/editar" options={{ title: "Editar ficha" }} />
      </Stack.Protected>

      {/* Vuelta del login con Google (si el sistema abre la app con el link). */}
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}
