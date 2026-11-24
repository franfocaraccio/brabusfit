import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { formatDuration } from "@brabus/shared";

import { Muted } from "@/components/ui";
import { fonts, makeStyles, useColors } from "@/lib/theme";

/** Progreso del día y cronómetro (o "Empezar"). */
export function TrainerHeader({
  completedCount,
  total,
  startedAt,
  now,
  onStart,
}: {
  completedCount: number;
  total: number;
  startedAt: number | null;
  now: number;
  onStart: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.topRow}>
      <Muted style={{ flex: 1 }}>
        {completedCount} de {total} ejercicios completados
      </Muted>
      {startedAt === null ? (
        <Pressable
          onPress={onStart}
          style={({ pressed }) => [
            styles.startButton,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="play" size={14} color={colors.primaryForeground} />
          <Text style={styles.startText}>Empezar</Text>
        </Pressable>
      ) : (
        <View
          style={styles.timerPill}
          accessibilityLabel="Tiempo de entrenamiento"
        >
          <Ionicons name="timer-outline" size={16} color={colors.primaryText} />
          <Text style={styles.timerText}>
            {formatDuration(now - startedAt)}
          </Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  startText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primaryForeground,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.15)",
  },
  timerText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.primaryText,
    fontVariant: ["tabular-nums"],
  },
}));
