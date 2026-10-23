import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Tile tocable: chip (ícono o número) + título + subtítulo + flecha. */
export function Tile({
  title,
  subtitle,
  icon,
  chip,
  accent,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  chip?: ReactNode;
  accent?: boolean;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && {
          borderColor: "rgba(249,115,22,0.5)",
          transform: [{ scale: 0.99 }],
        },
      ]}
    >
      <View
        style={[styles.chip, accent ? styles.chipAccent : styles.chipMuted]}
      >
        {chip !== undefined ? (
          <Text
            style={[
              styles.chipText,
              { color: accent ? colors.primaryForeground : colors.foreground },
            ]}
          >
            {chip}
          </Text>
        ) : icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={accent ? colors.primaryForeground : colors.foreground}
          />
        ) : null}
      </View>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.overlay,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  chipAccent: { backgroundColor: colors.primary },
  chipMuted: { backgroundColor: colors.muted },
  chipText: { fontFamily: fonts.bold, fontSize: 16 },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.foreground },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
}));
