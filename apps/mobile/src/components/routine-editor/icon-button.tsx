import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import { makeStyles, useColors } from "@/lib/theme";

/** Botón de ícono (subir, bajar, eliminar) de los editores de rutinas y planes. */
export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  compact,
  narrow,
}: {
  /** Más bajo (columna de acciones de un ejercicio). */
  compact?: boolean;
  /** Más angosto (encabezado de una comida). */
  narrow?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      style={[
        styles.iconButton,
        compact && { height: 32 },
        narrow && { width: 36 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  iconButton: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
}));
