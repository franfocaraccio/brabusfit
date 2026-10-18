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
      <StatusBar style="light" />
      <RootNavigator fontsLoaded={fontsLoaded} />
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
  // Usuarios de Google que no completaron su perfil (se completa en la web).
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
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="completar-perfil" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="index" options={{ title: "Rutinas" }} />
        <Stack.Screen name="rutina/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="rutina/[id]/dia/[dayId]" options={{ title: "" }} />
      </Stack.Protected>
    </Stack>
  );
}
