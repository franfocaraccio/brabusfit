import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import {
  cardElevation,
  fonts,
  makeStyles,
  radius,
  useColors,
  useTheme,
  type Palette,
} from "@/lib/theme";

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

export function Logo({ size = 28 }: { size?: number }) {
  const colors = useColors();
  const styles = useStyles();
  // Unbounded es ancha: se achica para ocupar lo mismo que el logo anterior.
  return (
    <Text style={[styles.logo, { fontSize: Math.round(size * 0.72) }]}>
      BRABUS <Text style={{ color: colors.primaryText }}>FIT</Text>
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant =
  "primary" | "secondary" | "outline" | "ghost" | "destructive";

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
  const styles = useStyles();
  const colors = useColors();
  const isDisabled = disabled || loading;
  const v = buttonVariants(colors)[variant];
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
        pressed &&
          !isDisabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
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

const buttonVariants = (
  colors: Palette,
): Record<
  ButtonVariant,
  { container: ViewStyle; text: { color: string } }
> => ({
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
});

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
  const styles = useStyles();
  const { scheme, colors } = useTheme();
  // Oscuro: borde fino. Claro: sombra suave.
  return (
    <View
      style={[
        styles.card,
        scheme === "light" && cardElevation(scheme, colors),
        style,
      ]}
    >
      {children}
    </View>
  );
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
  const colors = useColors();
  const styles = useStyles();
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
  const styles = useStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const useStyles = makeStyles((colors) => ({
  logo: {
    fontFamily: fonts.logo,
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
    borderColor: colors.overlay,
  },
  field: { gap: 6 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  inputWrap: { justifyContent: "center" },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.field,
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
}));
