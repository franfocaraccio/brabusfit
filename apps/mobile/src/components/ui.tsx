import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { colors, fonts, radius } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Text style={[styles.logo, { fontSize: size }]}>
      BRABUS <Text style={{ color: colors.primary }}>FIT</Text>
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        v.container,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color} />
      ) : (
        <View style={styles.buttonContent}>
          {icon}
          <Text style={[styles.buttonText, v.text]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<
  ButtonVariant,
  { container: ViewStyle; text: { color: string } }
> = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    text: { color: colors.primaryForeground },
  },
  secondary: {
    container: { backgroundColor: colors.muted },
    text: { color: colors.foreground },
  },
  outline: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: { color: colors.foreground },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    text: { color: colors.mutedForeground },
  },
  destructive: {
    container: { backgroundColor: "rgba(239,68,68,0.15)" },
    text: { color: colors.destructive },
  },
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// TextField
// ---------------------------------------------------------------------------

export function TextField({
  label,
  suffix,
  style,
  ...props
}: TextInputProps & { label?: string; suffix?: string }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.primary}
          style={[styles.input, suffix ? { paddingRight: 40 } : null, style]}
          {...props}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  logo: {
    fontFamily: fonts.heading,
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: colors.muted,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.6,
  },
  buttonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(244,246,250,0.08)",
  },
  field: { gap: 6 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  inputWrap: { justifyContent: "center" },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: "rgba(43,51,61,0.4)",
    paddingHorizontal: 14,
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  suffix: {
    position: "absolute",
    right: 14,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    color: colors.foreground,
    letterSpacing: 0.2,
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
