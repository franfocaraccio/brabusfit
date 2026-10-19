import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { usernameError } from "@brabus/shared";
import {
  checkShareEmail,
  checkShareUsername,
  getRoutineShares,
  shareDisplayName,
  shareRoutine,
  unshareRoutine,
  type ShareRow,
} from "@brabus/supabase";

import { ErrorText, FieldHint } from "@/components/forms";
import { Loading } from "@/components/loading";
import { Button, Card, Muted, SectionLabel, TextField } from "@/components/ui";
import { notify } from "@/lib/confirm";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";

type Mode = "email" | "username";
type Tone = "muted" | "error" | "success" | "warning";

/** Compartir rutina por email o usuario (igual que el diálogo de la web). */
export default function CompartirScreen() {
  const { id: routineId } = useLocalSearchParams<{ id: string }>();

  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [mode, setMode] = useState<Mode>("email");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setShares(await getRoutineShares(supabase, routineId));
  }, [routineId]);

  useEffect(() => {
    getRoutineShares(supabase, routineId).then(setShares);
  }, [routineId]);

  const looksValid = useCallback(
    (v: string) => (mode === "email" ? /.+@.+\..+/.test(v.trim()) : !usernameError(v.trim())),
    [mode],
  );

  // Validación en vivo (debounced) según el modo.
  useEffect(() => {
    const v = value.trim();
    if (!v || !looksValid(v)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result =
        mode === "email"
          ? await checkShareEmail(supabase, routineId, v)
          : await checkShareUsername(supabase, routineId, v);
      if (!cancelled) {
        setStatus(result);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, mode, routineId, looksValid]);

  const onChange = (raw: string) => {
    const v = mode === "username" ? raw.toLowerCase() : raw;
    setValue(v);
    setStatus(null);
    setMessage(null);
    setError(null);
    setChecking(v.trim() !== "" && looksValid(v));
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setValue("");
    setStatus(null);
    setChecking(false);
    setMessage(null);
    setError(null);
  };

  // El botón se habilita SOLO cuando el destino es realmente compartible.
  const canShare =
    !pending &&
    !checking &&
    (mode === "email" ? status === "existing" || status === "new" : status === "existing");

  const submit = async () => {
    const v = value.trim();
    if (!canShare || !v) return;
    setPending(true);
    const result = await shareRoutine(supabase, routineId, { mode, value: v });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setMessage(
      result.data.existed
        ? "Rutina compartida."
        : "Invitación registrada. Se vinculará cuando cree su cuenta.",
    );
    setValue("");
    setStatus(null);
    load();
  };

  const remove = async (shareId: string) => {
    setPending(true);
    const result = await unshareRoutine(supabase, shareId);
    setPending(false);
    if (!result.ok) return notify("No se pudo dejar de compartir", result.error);
    load();
  };

  const feedback = ((): { text: string; tone: Tone } | null => {
    const v = value.trim();
    if (checking) return { text: "Verificando…", tone: "muted" };
    if (v && !looksValid(v)) {
      return mode === "username"
        ? { text: usernameError(v) ?? "", tone: "error" }
        : { text: "Email inválido.", tone: "error" };
    }
    switch (status) {
      case "self":
        return { text: mode === "email" ? "Ese es tu propio email." : "Ese sos vos.", tone: "error" };
      case "coach":
        return { text: "No podés compartir una rutina con un coach.", tone: "error" };
      case "not_found":
        return { text: "No existe un usuario con ese nombre.", tone: "error" };
      case "already":
        return { text: "Ya está compartida con ese destinatario.", tone: "warning" };
      case "existing":
        return { text: "Usuario encontrado — le llega al instante.", tone: "success" };
      case "new":
        return { text: "Se le enviará una invitación para crear su cuenta.", tone: "muted" };
      default:
        return null;
    }
  })();

  if (!shares) return <Loading />;

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
        <Muted>Compartí con tu alumno por email o por nombre de usuario.</Muted>

        <View style={styles.segment}>
          {(["email", "username"] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={[styles.segmentItem, mode === m && styles.segmentItemOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
            >
              <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>
                {m === "email" ? "Email" : "Usuario"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 6 }}>
          <TextField
            label={mode === "email" ? "Email del alumno" : "Nombre de usuario"}
            value={value}
            onChangeText={onChange}
            placeholder={mode === "email" ? "alumno@email.com" : "juan.perez"}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={mode === "email" ? "email-address" : "default"}
            onSubmitEditing={submit}
          />
          {feedback ? (
            feedback.tone === "warning" ? (
              <Text style={styles.warning}>{feedback.text}</Text>
            ) : (
              <FieldHint tone={feedback.tone}>{feedback.text}</FieldHint>
            )
          ) : null}
        </View>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {message ? <FieldHint tone="success">{message}</FieldHint> : null}

        <Button title="Compartir" onPress={submit} disabled={!canShare} loading={pending && canShare} />

        {shares.length > 0 ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>Compartida con</SectionLabel>
            <Card style={{ overflow: "hidden" }}>
              {shares.map((s, i) => (
                <View key={s.id} style={[styles.shareRow, i > 0 && styles.shareRowBorder]}>
                  <Ionicons
                    name={s.status === "accepted" ? "person-circle-outline" : "time-outline"}
                    size={22}
                    color={s.status === "accepted" ? colors.success : colors.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shareName} numberOfLines={1}>
                      {shareDisplayName(s)}
                    </Text>
                    <Text style={styles.shareMeta} numberOfLines={1}>
                      {s.status === "accepted"
                        ? s.shared_with_email
                        : `${s.shared_with_email} · Pendiente`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => remove(s.id)}
                    disabled={pending}
                    hitSlop={8}
                    accessibilityLabel="Dejar de compartir"
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  segment: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  segmentItem: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.sm },
  segmentItemOn: { backgroundColor: colors.card },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.mutedForeground },
  segmentTextOn: { color: colors.foreground },
  warning: { fontFamily: fonts.regular, fontSize: 13, color: "#f59e0b" },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shareRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  shareName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  shareMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
});
