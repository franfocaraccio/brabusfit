import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { formatDuration, type RestTimer } from "@brabus/shared";

import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

/** Descanso en curso: tiempo que falta, ±15 s y "Saltar". */
export function RestBar({
  rest,
  secondsLeft,
  onAdjust,
  onSkip,
}: {
  rest: RestTimer;
  secondsLeft: number;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View
      style={styles.restBar}
      accessibilityRole="timer"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="timer-outline" size={22} color={colors.primaryText} />
      <View style={{ flex: 1 }}>
        <Text style={styles.restLabel} numberOfLines={1}>
          Descanso · {rest.exerciseName}
        </Text>
        <Text style={styles.restTime}>
          {formatDuration(secondsLeft * 1000)}
        </Text>
      </View>
      <Pressable
        onPress={() => onAdjust(-15)}
        style={styles.restButton}
        hitSlop={4}
      >
        <Text style={styles.restButtonText}>−15 s</Text>
      </Pressable>
      <Pressable
        onPress={() => onAdjust(15)}
        style={styles.restButton}
        hitSlop={4}
      >
        <Text style={styles.restButtonText}>+15 s</Text>
      </Pressable>
      <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
        <Text style={styles.restSkip}>Saltar</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  restBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(249,115,22,0.15)",
  },
  restLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  restTime: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  restButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.input,
  },
  restButtonText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.foreground,
  },
  restSkip: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.mutedForeground,
  },
}));
