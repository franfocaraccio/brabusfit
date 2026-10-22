import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { GoogleButton } from "@/components/google-button";
import { Button, Card, Logo, Muted, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim() !== "" && password !== "" && !loading;

  const signIn = async () => {
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    // Si sale bien, el AuthProvider detecta la sesión y navega solo.
    if (authError) setError("Email o contraseña incorrectos.");
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Brillo de la marca detrás del logo (igual que el login web). */}
      <Svg style={styles.glow} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="0%" rx="60%" ry="55%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Logo size={40} />
            <Muted>Tu entrenamiento, en un solo lugar</Muted>
          </View>

          <Card style={styles.card}>
            <GoogleButton onError={setError} />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <TextField
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={canSubmit ? signIn : undefined}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title="Ingresar"
              onPress={signIn}
              disabled={!canSubmit}
              loading={loading}
              style={{ minHeight: 44 }}
            />
          </Card>

          <Text style={styles.footer}>
            ¿No tenés cuenta?{" "}
            <Text style={styles.link} onPress={() => router.push("/signup")}>
              Crear cuenta
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    gap: 24,
  },
  header: { alignItems: "center", gap: 8 },
  card: { padding: 18, gap: 16 },
  error: { color: colors.destructive, fontFamily: fonts.regular, fontSize: 14 },
  footer: {
    textAlign: "center",
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  link: { color: colors.foreground, fontFamily: fonts.semibold },
});
