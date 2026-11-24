import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

/** Campo tipo selector: etiqueta y un botón que abre las opciones. */
export function SelectField({
  label,
  icon,
  value,
  placeholder,
  onPress,
  children,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Texto elegido; null muestra el placeholder. */
  value: string | null;
  placeholder?: string;
  onPress: () => void;
  /** Lo que va debajo (aclaración o campo extra). */
  children?: ReactNode;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={styles.select}
        accessibilityRole="button"
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.mutedForeground} />
        ) : null}
        <Text
          style={[
            styles.selectText,
            value === null && { color: colors.mutedForeground },
          ]}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
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
    backgroundColor: colors.field,
  },
  selectText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.foreground,
  },
}));
