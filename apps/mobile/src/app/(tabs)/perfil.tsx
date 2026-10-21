import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { displayDateError, formatDisplayDate, parseDisplayDate } from "@brabus/shared";
import { updateProfile } from "@brabus/supabase";

import { Col, DateField, DecimalField, ErrorText, FieldHint, Row } from "@/components/forms";
import { MyCoaches } from "@/components/my-coaches";
import { Button, Card, Muted, SectionLabel, TextField } from "@/components/ui";
import { confirm } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** Mi perfil: datos personales editables + cuenta (email y rol fijos). */
export default function PerfilScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [birthDate, setBirthDate] = useState(formatDisplayDate(profile?.birth_date));
  const [heightCm, setHeightCm] = useState(profile?.height_cm?.toString().replace(".", ",") ?? "");
  const [weightKg, setWeightKg] = useState(profile?.weight_kg?.toString().replace(".", ",") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canSave =
    !saving && firstName.trim() !== "" && lastName.trim() !== "" && !displayDateError(birthDate);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateProfile(supabase, {
      firstName,
      lastName,
      birthDate: parseDisplayDate(birthDate),
      heightCm,
      weightKg,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaved(true);
    refreshProfile();
  };

  const onSignOut = () =>
    confirm({
      title: "Cerrar sesión",
      message: "¿Querés salir de tu cuenta?",
      confirmText: "Salir",
      destructive: true,
      onConfirm: signOut,
    });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!profile?.is_coach ? <MyCoaches /> : null}

        <Card style={styles.card}>
          <SectionLabel>Datos personales</SectionLabel>
          <Row>
            <Col>
              <TextField
                label="Nombre"
                value={firstName}
                onChangeText={(v) => {
                  setFirstName(v);
                  setSaved(false);
                }}
              />
            </Col>
            <Col>
              <TextField
                label="Apellido"
                value={lastName}
                onChangeText={(v) => {
                  setLastName(v);
                  setSaved(false);
                }}
              />
            </Col>
          </Row>
          <DateField
            label="Fecha de nacimiento"
            value={birthDate}
            onChangeText={(v) => {
              setBirthDate(v);
              setSaved(false);
            }}
          />
          <Row>
            <Col>
              <DecimalField
                label="Altura (cm)"
                value={heightCm}
                onChangeText={(v) => {
                  setHeightCm(v);
                  setSaved(false);
                }}
                placeholder="175"
              />
            </Col>
            <Col>
              <DecimalField
                label="Peso (kg)"
                value={weightKg}
                onChangeText={(v) => {
                  setWeightKg(v);
                  setSaved(false);
                }}
                placeholder="70"
              />
            </Col>
          </Row>

          {error ? <ErrorText>{error}</ErrorText> : null}
          {saved ? <FieldHint tone="success">Perfil actualizado</FieldHint> : null}

          <Button title="Guardar cambios" onPress={save} disabled={!canSave} loading={saving} />
        </Card>

        <Card style={styles.card}>
          <SectionLabel>Cuenta</SectionLabel>
          <InfoRow label="Email" value={session?.user.email ?? ""} />
          <InfoRow label="Usuario" value={profile?.username ? `@${profile.username}` : "—"} />
          <InfoRow label="Rol" value={profile?.is_coach ? "Coach" : "Alumno"} last />
          <Muted style={{ fontSize: 12 }}>El email y el rol no se pueden modificar.</Muted>
        </Card>

        <Button title="Cerrar sesión" variant="destructive" onPress={onSignOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { padding: 16, gap: 14 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.mutedForeground },
  infoValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground, flexShrink: 1 },
});
