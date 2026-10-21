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

import { displayDateError, parseDisplayDate } from "@brabus/shared";
import { signUp } from "@brabus/supabase";

import {
  CheckRow,
  Col,
  DateField,
  DecimalField,
  ErrorText,
  Row,
  UsernameField,
} from "@/components/forms";
import { GoogleButton } from "@/components/google-button";
import { Button, Card, Logo, Muted, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";

export default function SignupScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [usernameValid, setUsernameValid] = useState(false);
  const [password, setPassword] = useState("");
  const [isCoach, setIsCoach] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !loading &&
    usernameValid &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= 6 &&
    !displayDateError(birthDate);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const result = await signUp(supabase, {
      email,
      password,
      firstName,
      lastName,
      birthDate: parseDisplayDate(birthDate),
      heightCm,
      weightKg,
      username,
      isCoach,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Con sesión, el AuthProvider detecta el login y los guards navegan solos.
    if (!result.data.hasSession) {
      setError("Te enviamos un email para confirmar tu cuenta.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Logo size={32} />
            <Muted>Creá tu cuenta para empezar.</Muted>
          </View>

          <Card style={styles.card}>
            <GoogleButton onError={setError} />

            <Row>
              <Col>
                <TextField label="Nombre" value={firstName} onChangeText={setFirstName} />
              </Col>
              <Col>
                <TextField label="Apellido" value={lastName} onChangeText={setLastName} />
              </Col>
            </Row>

            <DateField label="Fecha de nacimiento" value={birthDate} onChangeText={setBirthDate} />

            <Row>
              <Col>
                <DecimalField
                  label="Altura (cm)"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  placeholder="175"
                />
              </Col>
              <Col>
                <DecimalField
                  label="Peso (kg)"
                  value={weightKg}
                  onChangeText={setWeightKg}
                  placeholder="70"
                />
              </Col>
            </Row>

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

            <UsernameField
              value={username}
              onChangeText={setUsername}
              onValidChange={setUsernameValid}
            />

            <TextField
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="Mínimo 6 caracteres"
            />

            <CheckRow
              checked={isCoach}
              onChange={setIsCoach}
              title="Soy coach"
              description="Vas a poder armarles rutinas a tus alumnos."
            />

            {error ? <ErrorText>{error}</ErrorText> : null}

            <Button
              title="Crear cuenta"
              onPress={submit}
              disabled={!canSubmit}
              loading={loading}
            />
          </Card>

          <Text style={styles.footer}>
            ¿Ya tenés cuenta?{" "}
            <Text style={styles.link} onPress={() => router.back()}>
              Ingresar
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 20, gap: 20 },
  header: { alignItems: "center", gap: 6 },
  card: { padding: 18, gap: 14 },
  footer: {
    textAlign: "center",
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  link: { color: colors.primary, fontFamily: fonts.semibold },
});
