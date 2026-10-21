import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { usernameError, type AddStudentStatus } from "@brabus/shared";
import { addStudent, checkAddStudent, unlinkStudent } from "@brabus/supabase";

import { ErrorText, FieldHint } from "@/components/forms";
import { Segmented } from "@/components/segmented";
import { Sheet } from "@/components/sheet";
import { Button, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";

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
      description="Le llega una invitación. Mientras tanto ya podés armarle rutinas: las va a ver cuando la acepte."
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

/**
 * Desvincular un alumno o cancelar su invitación (igual que la web). Las rutinas
 * que el coach le armó: el alumno se queda con una copia propia (si el vínculo
 * estaba activo) y el coach conserva la suya.
 */
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmUnlink = async () => {
    setSaving(true);
    setError(null);
    const result = await unlinkStudent(supabase, linkId);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onClose();
    onDone();
  };

  const routinesText =
    routineCount === 0
      ? ""
      : pending
        ? routineCount === 1
          ? " La rutina que le armaste te queda guardada."
          : ` Las ${routineCount} rutinas que le armaste te quedan guardadas.`
        : routineCount === 1
          ? " Se queda con una copia propia de la rutina que le armaste, y vos conservás la tuya."
          : ` Se queda con una copia propia de las ${routineCount} rutinas que le armaste, y vos conservás las tuyas.`;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={pending ? "Cancelar invitación" : `Desvincular a ${name}`}
      description={
        (pending
          ? "Se borra la invitación."
          : "Deja de ser tu alumno: ya no vas a ver su progreso ni sus entrenamientos.") +
        routinesText
      }
    >
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
