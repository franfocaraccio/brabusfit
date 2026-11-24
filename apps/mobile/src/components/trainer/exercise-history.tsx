import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import {
  formatShortDate,
  HISTORY_PREVIEW,
  historyLabel,
  summarizeHistory,
  type HistoryEntry,
} from "@brabus/shared";

import { Muted } from "@/components/ui";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

/** Últimos entrenamientos (desplegable), "Ver más" y aviso de precarga. */
export function ExerciseHistory({
  history,
  open,
  onToggle,
  onShowAll,
}: {
  history: HistoryEntry[];
  open: boolean;
  onToggle: () => void;
  onShowAll: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={onToggle} style={styles.historyToggle}>
        <Ionicons
          name="time-outline"
          size={15}
          color={colors.mutedForeground}
        />
        <Text style={styles.historyToggleText}>
          {historyLabel(history.length)}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={15}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open &&
        history
          .slice(0, HISTORY_PREVIEW)
          .map((h, i) => <HistoryRow key={i} entry={h} />)}
      {open && history.length > HISTORY_PREVIEW ? (
        <Pressable
          onPress={onShowAll}
          hitSlop={8}
          accessibilityRole="button"
          style={{ alignSelf: "flex-start" }}
        >
          <Text style={styles.seeMore}>Ver más</Text>
        </Pressable>
      ) : null}
      <Muted style={{ fontSize: 13 }}>
        Precargado con tu entrenamiento del {formatShortDate(history[0].date)}.
        Si progresaste, editalo.
      </Muted>
    </View>
  );
}

export function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const styles = useStyles();
  return (
    <View style={styles.historyRow}>
      <Text style={styles.historyDate}>{formatShortDate(entry.date)}</Text>
      <Text style={styles.historySets}>{summarizeHistory(entry)}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  historyToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyToggleText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  historyRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.subtle,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyDate: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  historySets: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.foreground,
  },
  seeMore: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primaryText,
  },
}));
