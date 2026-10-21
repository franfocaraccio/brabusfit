import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { usernameError, type AddStudentStatus } from "@brabus/shared";
import { addStudent, checkAddStudent, unlinkStudent } from "@brabus/supabase";

import { ErrorText, FieldHint } from "@/components/forms";
import { Segmented } from "@/components/segmented";
import { Sheet } from "@/components/sheet";
import { Button, Muted, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius } from "@/lib/theme";

type Mode = "email" | "username";

const FEEDBACK: Partial<Record<AddStudentStatus, { text: string; tone: "error" | "success" | "muted" }>> = {
  self: { text: "No podés agregarte a vos mismo.", tone: "error" },
  coach: { text: "No podés agregar a un coach como alumno.", tone: "error" },
  not_found: { text: "No existe un usuario con ese nombre.", tone: "error" },
  already: { text: "Ya es tu alumno (o tiene la invitación pendiente).", tone: "error" },
  existing: { text: "Usuario encontrado: le va a llegar la invitación.", tone: "success" },
  new: { text: "Todavía no tiene cuenta: va a ver la invitación cuando se registre.", tone: "muted" },
};

/** Agregar alumno (igual que el diálogo de la web): queda con invitación pendiente. */
export function AddStudentSheet({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<Mode>("username");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<AddStudentStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const looksValid = (v: string, m: Mode) =>
    m === "email" ? /.+@.+\..+/.test(v.trim()) : !usernameError(v.trim());

  useEffect(() => {
    const v = value.trim();
    if (!v || !looksValid(v, mode)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await checkAddStudent(supabase, mode, v);
      if (!cancelled) {
        setStatus(result);
        setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, mode]);

  const reset = (m: Mode) => {
    setMode(m);
    setValue("");
    setStatus(null);
    setChecking(false);
    setError(null);
  };

  const onChange = (raw: string) => {
    const v = mode === "username" ? raw.toLowerCase() : raw;
    setValue(v);
    setStatus(null);
    setError(null);
    setChecking(v.trim() !== "" && looksValid(v, mode));
  };

  const canAdd = !saving && !checking && (status === "existing" || status === "new");

  const submit = async () => {
    if (!canAdd) return;
    setSaving(true);
    const result = await addStudent(supabase, mode, value.trim());
    setSaving(false);
    if (!result.ok) return setError(result.error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    reset(mode);
    onAdded();
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
      title="Agregar alumno"
      description="Le llega una invitación. Mientras tanto ya podés compartirle rutinas: las va a ver cuando la acepte."
    >
      <Segmented
        value={mode}
        onChange={reset}
        options={[
          { value: "username", label: "Usuario" },
          { value: "email", label: "Email" },
        ]}
      />
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
        {feedback ? <FieldHint tone={feedback.tone}>{feedback.text}</FieldHint> : null}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Agregar" onPress={submit} disabled={!canAdd} loading={saving} />
    </Sheet>
  );
}

/** Desvincular un alumno o cancelar su invitación (igual que la web). */
export function UnlinkStudentSheet({
  visible,
  onClose,
  linkId,
  name,
  pending,
  routineCount,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  linkId: string;
  name: string;
  pending: boolean;
  routineCount: number;
  onDone: () => void;
}) {
  const [keepRoutines, setKeepRoutines] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmUnlink = async () => {
    setSaving(true);
    setError(null);
    const result = await unlinkStudent(supabase, linkId, { keepRoutines: !pending && keepRoutines });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onClose();
    onDone();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={pending ? "Cancelar invitación" : `Desvincular a ${name}`}
      description={
        pending
          ? "Se borra la invitación y lo que le compartiste mientras estaba pendiente."
          : "Deja de ser tu alumno: ya no vas a ver su progreso ni sus entrenamientos."
      }
    >
      {!pending ? (
        <View style={{ gap: 8 }}>
          <Muted style={{ fontSize: 13 }}>¿Qué conserva?</Muted>
          <Pressable
            onPress={() => setKeepRoutines((k) => !k)}
            style={styles.check}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: keepRoutines }}
          >
            <View style={[styles.box, keepRoutines && styles.boxOn]}>
              {keepRoutines ? (
                <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.checkTitle}>Seguir compartiéndole sus rutinas</Text>
              <Text style={styles.checkHint}>
                {routineCount === 0
                  ? "Hoy no tiene rutinas tuyas."
                  : `Conserva ${routineCount === 1 ? "la rutina" : `las ${routineCount} rutinas`} que le compartiste.`}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        title={pending ? "Cancelar invitación" : "Desvincular"}
        variant="destructive"
        onPress={confirmUnlink}
        loading={saving}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  check: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.mutedForeground,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.foreground },
  checkHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground },
});
