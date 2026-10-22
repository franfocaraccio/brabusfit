import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CLIENT_STATUS_LABEL,
  CLIENT_GOALS,
  CLIENT_LEVELS,
  CLIENT_SEXES,
  EMPTY_CLIENT,
  displayDateError,
  formatDisplayDate,
  parseDisplayDate,
  usernameError,
  type ClientInput,
  type ClientStatus,
  type InviteStatus,
} from "@brabus/shared";
import { checkInviteClient, inviteClient, saveClient } from "@brabus/supabase";

import { Col, DateField, DecimalField, ErrorText, FieldHint, Row } from "@/components/forms";
import { Segmented } from "@/components/segmented";
import { OptionList, Sheet } from "@/components/sheet";
import { Button, Card, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Etiqueta del acceso a la app
// ---------------------------------------------------------------------------

/** Vinculado / Invitación pendiente / Usuario no registrado / Sin invitar. */
export function AccessBadge({ status }: { status: ClientStatus }) {
  return (
    <Text
      style={[
        styles.badge,
        status === "linked" && styles.badgeActive,
        status === "invited" && styles.badgePending,
        status === "unregistered" && styles.badgeUnregistered,
      ]}
    >
      {CLIENT_STATUS_LABEL[status]}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Ficha: alta / edición (igual que ClientForm de la web)
// ---------------------------------------------------------------------------

type Picker = "sex" | "goal" | "level" | null;

export function ClientForm({
  clientId,
  initial,
  emailLocked = false,
}: {
  clientId?: string;
  initial?: ClientInput;
  emailLocked?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ClientInput>(initial ?? EMPTY_CLIENT);
  const [birth, setBirth] = useState(formatDisplayDate(initial?.birth_date));
  const [picker, setPicker] = useState<Picker>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const pickers = {
    sex: { title: "Sexo", options: CLIENT_SEXES },
    goal: { title: "Objetivo", options: CLIENT_GOALS },
    level: { title: "Nivel", options: CLIENT_LEVELS },
  } as const;

  const submit = async () => {
    setError(null);
    const birthError = displayDateError(birth);
    if (birthError) return setError(`Fecha de nacimiento: ${birthError}`);
    setSaving(true);
    const result = await saveClient(supabase, clientId ?? null, {
      ...data,
      birth_date: parseDisplayDate(birth) ?? "",
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (clientId) router.back();
    else router.replace(`/cliente/${result.data.id}`);
  };

  const select = (key: Exclude<Picker, null>) => {
    const value = data[key];
    const label = pickers[key].options.find((o) => o.value === value)?.label;
    return (
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>{pickers[key].title}</Text>
        <Pressable onPress={() => setPicker(key)} style={styles.select} accessibilityRole="button">
          <Text style={[styles.selectText, !label && { color: colors.mutedForeground }]}>
            {label ?? "Sin dato"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
    );
  };

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
        <Row>
          <Col>
            <TextField
              label="Nombre *"
              value={data.first_name}
              onChangeText={(v) => set("first_name", v)}
            />
          </Col>
          <Col>
            <TextField
              label="Apellido"
              value={data.last_name}
              onChangeText={(v) => set("last_name", v)}
            />
          </Col>
        </Row>
        <TextField
          label="Teléfono / WhatsApp"
          value={data.phone}
          onChangeText={(v) => set("phone", v)}
          keyboardType="phone-pad"
          placeholder="+54 9 11 1234-5678"
        />
        <View style={{ gap: 4 }}>
          <TextField
            label="Email"
            value={data.email}
            onChangeText={(v) => set("email", v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!emailLocked}
          />
          {emailLocked ? <FieldHint>Es el de su cuenta en la app.</FieldHint> : null}
        </View>
        <DateField label="Fecha de nacimiento" value={birth} onChangeText={setBirth} />
        {select("sex")}
        <Row>
          <Col>
            <DecimalField
              label="Estatura (cm)"
              value={data.height_cm}
              onChangeText={(v) => set("height_cm", v)}
              placeholder="170"
            />
          </Col>
          <Col>
            <DecimalField
              label="Peso inicial (kg)"
              value={data.initial_weight_kg}
              onChangeText={(v) => set("initial_weight_kg", v)}
              placeholder="70,5"
            />
          </Col>
        </Row>
        {select("goal")}
        {select("level")}
        <TextField
          label="Lesiones / patologías"
          value={data.injuries}
          onChangeText={(v) => set("injuries", v)}
          multiline
          style={styles.multiline}
          placeholder="Ej: dolor lumbar, operado de rodilla…"
        />
        <View style={{ gap: 4 }}>
          <TextField
            label="Notas privadas"
            value={data.notes}
            onChangeText={(v) => set("notes", v)}
            multiline
            style={styles.multiline}
          />
          <FieldHint>Solo las ves vos, aunque use la app.</FieldHint>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          title={clientId ? "Guardar cambios" : "Crear cliente"}
          onPress={submit}
          loading={saving}
          disabled={!data.first_name.trim()}
        />
      </View>

      <Sheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker ? pickers[picker].title : ""}
      >
        {picker ? (
          <OptionList
            value={data[picker] || "__none__"}
            options={[
              { value: "__none__", label: "Sin dato" },
              ...pickers[picker].options.map((o) => ({ value: o.value as string, label: o.label })),
            ]}
            onSelect={(v) => {
              setData((d) => ({ ...d, [picker]: v === "__none__" ? "" : v }));
              setPicker(null);
            }}
          />
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Invitar a la app
// ---------------------------------------------------------------------------

type Mode = "email" | "username";

const FEEDBACK: Partial<Record<InviteStatus, { text: string; tone: "error" | "success" | "muted" }>> = {
  self: { text: "No podés invitarte a vos mismo.", tone: "error" },
  coach: { text: "No podés invitar a un coach como cliente.", tone: "error" },
  not_found: { text: "No existe un usuario con ese nombre.", tone: "error" },
  already: { text: "Otro de tus clientes ya usa esa cuenta o email.", tone: "error" },
  existing: { text: "Usuario encontrado: le va a llegar la invitación.", tone: "success" },
  new: {
    text: "Todavía no tiene cuenta: va a ver la invitación cuando se registre con ese email.",
    tone: "muted",
  },
};

export function InviteClientSheet({
  visible,
  onClose,
  clientId,
  name,
  defaultEmail,
  onInvited,
}: {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  name: string;
  defaultEmail: string;
  onInvited: () => void;
}) {
  const [mode, setMode] = useState<Mode>(defaultEmail ? "email" : "username");
  const [value, setValue] = useState(defaultEmail);
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [checking, setChecking] = useState(Boolean(defaultEmail));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const looksValid = (v: string, m: Mode) =>
    m === "email" ? /.+@.+\..+/.test(v.trim()) : !usernameError(v.trim());

  useEffect(() => {
    const v = value.trim();
    if (!visible || !v || !looksValid(v, mode)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await checkInviteClient(supabase, clientId, mode, v);
      if (!cancelled) {
        setStatus(result);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, mode, visible, clientId]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setValue(m === "email" ? defaultEmail : "");
    setStatus(null);
    setError(null);
    setChecking(m === "email" && Boolean(defaultEmail));
  };

  const onChange = (raw: string) => {
    const v = mode === "username" ? raw.toLowerCase() : raw;
    setValue(v);
    setStatus(null);
    setError(null);
    setChecking(v.trim() !== "" && looksValid(v, mode));
  };

  const canInvite = !saving && !checking && (status === "existing" || status === "new");

  const submit = async () => {
    if (!canInvite) return;
    setSaving(true);
    const result = await inviteClient(supabase, clientId, mode, value.trim());
    setSaving(false);
    if (!result.ok) return setError(result.error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onInvited();
    onClose();
  };

  const v = value.trim();
  const feedback = checking
    ? { text: "Verificando…", tone: "muted" as const }
    : v && !looksValid(v, mode)
      ? {
          text: mode === "username" ? (usernameError(v) ?? "") : "Email inválido.",
          tone: "error" as const,
        }
      : status
        ? FEEDBACK[status]
        : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Invitar a ${name} a la app`}
      description="Cuando acepte va a ver las rutinas que le armaste y vas a poder seguir su progreso. La ficha y tus notas siguen siendo privadas."
    >
      <Segmented
        value={mode}
        onChange={switchMode}
        options={[
          { value: "username", label: "Usuario" },
          { value: "email", label: "Email" },
        ]}
      />
      <View style={{ gap: 6 }}>
        <TextField
          label={mode === "email" ? "Email" : "Nombre de usuario"}
          value={value}
          onChangeText={onChange}
          placeholder={mode === "email" ? "cliente@email.com" : "juan.perez"}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={mode === "email" ? "email-address" : "default"}
          onSubmitEditing={submit}
        />
        {feedback ? <FieldHint tone={feedback.tone}>{feedback.text}</FieldHint> : null}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Invitar" onPress={submit} disabled={!canInvite} loading={saving} />
    </Sheet>
  );
}

/** Dato de la ficha (etiqueta + valor) en una grilla. */
export function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, !value && { color: colors.mutedForeground }]}>
        {value ?? "—"}
      </Text>
    </View>
  );
}

export function FactCard({ children }: { children: React.ReactNode }) {
  return <Card style={styles.factCard}>{children}</Card>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: "rgba(43,51,61,0.4)",
  },
  selectText: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.foreground },
  multiline: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  badge: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  badgeActive: { color: "#10b981", backgroundColor: "rgba(16,185,129,0.15)" },
  badgePending: { color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)" },
  badgeUnregistered: { color: "#38bdf8", backgroundColor: "rgba(14,165,233,0.15)" },
  factCard: { padding: 14, flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  fact: { width: "50%", paddingRight: 8, gap: 2 },
  factLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  factValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
});
