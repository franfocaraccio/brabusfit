import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  displayDateError,
  formatDisplayDate,
  parseDisplayDate,
} from "@brabus/shared";
import { completeProfile } from "@brabus/supabase";

import {
  CheckRow,
  Col,
  DateField,
  DecimalField,
  ErrorText,
  Row,
  UsernameField,
} from "@/components/forms";
import { Button, Card, Logo, Muted, TextField, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { makeStyles } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/**
 * Onboarding de usuarios que entraron con Google: username, rol y datos
 * físicos (igual que /completar-perfil en la web).
 */
export default function CompletarPerfilScreen() {
  const styles = useStyles();
  const { profile, signOut, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [usernameValid, setUsernameValid] = useState(
    Boolean(profile?.username),
  );
  const [birthDate, setBirthDate] = useState(
    formatDisplayDate(profile?.birth_date),
  );
  const [heightCm, setHeightCm] = useState(
    profile?.height_cm?.toString().replace(".", ",") ?? "",
  );
  const [weightKg, setWeightKg] = useState(
    profile?.weight_kg?.toString().replace(".", ",") ?? "",
  );
  const [isCoach, setIsCoach] = useState(profile?.is_coach ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !loading &&
    usernameValid &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    !displayDateError(birthDate);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const result = await completeProfile(supabase, {
      firstName,
      lastName,
      birthDate: parseDisplayDate(birthDate),
      heightCm,
      weightKg,
      username,
      isCoach,
    });
    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }
    // Con onboarded = true los guards llevan al inicio.
    await refreshProfile();
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
            <Logo size={32} />
          </View>
          <Card style={styles.card}>
            <Title>Completá tu perfil</Title>
            <Muted>Antes de empezar necesitamos un par de datos más.</Muted>

            <Row>
              <Col>
                <TextField
                  label="Nombre"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </Col>
              <Col>
                <TextField
                  label="Apellido"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </Col>
            </Row>

            <UsernameField
              value={username}
              onChangeText={setUsername}
              onValidChange={setUsernameValid}
              initial={profile?.username}
            />

            <DateField
              label="Fecha de nacimiento"
              value={birthDate}
              onChangeText={setBirthDate}
            />

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

            <CheckRow
              checked={isCoach}
              onChange={setIsCoach}
              title="Soy coach"
              description="Vas a poder cargar a tus clientes y armarles rutinas."
            />

            {error ? <ErrorText>{error}</ErrorText> : null}

            <Button
              title="Guardar y continuar"
              onPress={submit}
              disabled={!canSubmit}
              loading={loading}
            />
            <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 20 },
  header: { alignItems: "center" },
  card: { padding: 18, gap: 14 },
}));
