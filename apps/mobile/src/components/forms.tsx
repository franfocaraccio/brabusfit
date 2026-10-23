import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, View, type TextInputProps } from "react-native";

import {
  displayDateError,
  maskDisplayDate,
  sanitizeDecimal,
  usernameError,
} from "@brabus/shared";
import { isUsernameAvailable } from "@brabus/supabase";

import { TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

/** Número con coma o punto (mismo criterio que DecimalInput de la web). */
export function DecimalField({
  value,
  onChangeText,
  ...props
}: TextInputProps & { label?: string; suffix?: string; value: string }) {
  return (
    <TextField
      keyboardType="decimal-pad"
      inputMode="decimal"
      value={value}
      onChangeText={(t) => onChangeText?.(sanitizeDecimal(t))}
      {...props}
    />
  );
}

/** Fecha DD/MM/AAAA con barras automáticas. */
export function DateField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  const error = value.length === 10 ? displayDateError(value) : null;
  return (
    <View style={{ gap: 4 }}>
      <TextField
        label={label}
        value={value}
        onChangeText={(t) => onChangeText(maskDisplayDate(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
      />
      {error ? <FieldHint tone="error">{error}</FieldHint> : null}
    </View>
  );
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * Nombre de usuario con validación de formato + disponibilidad en vivo
 * (igual que UsernameField de la web). `initial` se considera válido.
 */
export function UsernameField({
  value,
  onChangeText,
  onValidChange,
  initial,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onValidChange: (valid: boolean) => void;
  initial?: string | null;
}) {
  const [status, setStatus] = useState<UsernameStatus>(
    initial ? "available" : "idle",
  );

  useEffect(() => {
    if (!value || usernameError(value)) return;
    if (initial && value === initial) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const available = await isUsernameAvailable(supabase, value);
      if (!cancelled) {
        setStatus(available ? "available" : "taken");
        onValidChange(available);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, initial, onValidChange]);

  const onChange = (raw: string) => {
    const v = raw.toLowerCase().trim();
    onChangeText(v);
    if (v === "") {
      setStatus("idle");
      onValidChange(false);
    } else if (usernameError(v)) {
      setStatus("invalid");
      onValidChange(false);
    } else if (initial && v === initial) {
      setStatus("available");
      onValidChange(true);
    } else {
      setStatus("checking");
      onValidChange(false);
    }
  };

  return (
    <View style={{ gap: 4 }}>
      <TextField
        label="Nombre de usuario"
        value={value}
        onChangeText={onChange}
        placeholder="juan.perez"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />
      {status === "invalid" ? (
        <FieldHint tone="error">{usernameError(value)}</FieldHint>
      ) : status === "checking" ? (
        <FieldHint>Verificando…</FieldHint>
      ) : status === "available" ? (
        <FieldHint tone="success">Disponible</FieldHint>
      ) : status === "taken" ? (
        <FieldHint tone="error">Ya está en uso.</FieldHint>
      ) : null}
    </View>
  );
}

export function FieldHint({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error" | "success";
}) {
  const colors = useColors();
  const styles = useStyles();
  const color =
    tone === "error"
      ? colors.destructive
      : tone === "success"
        ? colors.success
        : colors.mutedForeground;
  return <Text style={[styles.hint, { color }]}>{children}</Text>;
}

/** Checkbox con título y descripción (ej. "Soy coach"). */
export function CheckRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? (
          <Ionicons
            name="checkmark"
            size={16}
            color={colors.primaryForeground}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.checkTitle}>{title}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.error}>{children}</Text>;
}

/** Dos campos lado a lado. */
export function Row({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.row}>{children}</View>;
}

export function Col({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

const useStyles = makeStyles((colors) => ({
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  error: { color: colors.destructive, fontFamily: fonts.regular, fontSize: 14 },
  row: { flexDirection: "row", gap: 12 },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.subtle,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.mutedForeground,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkTitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.foreground,
  },
}));
