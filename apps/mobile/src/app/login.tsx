import * as Linking from "expo-linking";
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

import { Button, Card, Logo, Muted, TextField } from "@/components/ui";
import { WEB_URL } from "@/lib/config";
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
            <Muted>Tus rutinas, en un solo lugar.</Muted>
          </View>

          <Card style={styles.card}>
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
            />
          </Card>

          <Text style={styles.footer}>
            ¿No tenés cuenta?{" "}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL(`${WEB_URL}/signup`)}
            >
              Creala en la web
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
  link: { color: colors.primary, fontFamily: fonts.semibold },
});
