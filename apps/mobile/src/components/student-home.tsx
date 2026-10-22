import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { WEEKDAY_INITIALS, shortDate, studentDashboard } from "@brabus/shared";
import type { HomeRoutine } from "@brabus/supabase";

import { Card, Muted } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

/** Inicio del alumno (igual que StudentHome de la web): semana, 8 semanas y su rutina. */
export function StudentHome({
  finishedAt,
  routine,
}: {
  finishedAt: string[];
  routine: HomeRoutine | null;
}) {
  const goal = routine && routine.dayCount > 0 ? routine.dayCount : null;
  const stats = studentDashboard(finishedAt, goal);
  const max = Math.max(goal ?? 0, ...stats.weeks.map((w) => w.days), 1);
  const CHART_H = 96;

  return (
    <View style={{ gap: 12 }}>
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Semana en curso</Text>
          {goal ? <Text style={styles.label}>Objetivo {goal}</Text> : null}
        </View>
        <Text style={styles.big}>
          {stats.daysThisWeek}
          {goal ? <Text style={styles.bigGoal}> / {goal}</Text> : null}
        </Text>
        <View style={styles.rowBetween}>
          {WEEKDAY_INITIALS.map((d, i) => {
            const done = stats.thisWeek[i];
            const today = stats.todayIndex === i;
            const future = i > stats.todayIndex;
            return (
              <View
                key={i}
                style={[styles.dot, done ? styles.dotDone : today ? styles.dotToday : null]}
              >
                <Text
                  style={[
                    styles.dotText,
                    done && { color: colors.primaryForeground },
                    today && !done && { color: colors.foreground },
                    future && !done && !today && { opacity: 0.45 },
                  ]}
                >
                  {d}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Consistencia · 8 semanas</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Promedio {stats.average.toLocaleString("es-AR", { maximumFractionDigits: 1 })} / sem
          </Text>
        </View>
        <View style={[styles.chart, { height: CHART_H }]}>
          {goal ? (
            <View style={[styles.goalLine, { bottom: (goal / max) * CHART_H }]} />
          ) : null}
          {stats.weeks.map((w, i, all) => {
            const current = i === all.length - 1;
            const below = goal !== null && !current && w.days < goal;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: Math.max((w.days / max) * CHART_H, w.days ? 6 : 2),
                    opacity: current ? 0.55 : below ? 0.35 : 1,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.axis}>{shortDate(stats.weeks[0].start)}</Text>
          <Text style={styles.axis}>esta</Text>
        </View>
        {goal ? (
          <Text style={styles.label}>
            {stats.streak > 0
              ? `Racha: ${stats.streak} ${stats.streak === 1 ? "semana" : "semanas"} cumpliendo el objetivo`
              : "Cumplí el objetivo de la semana para empezar una racha"}
          </Text>
        ) : null}
      </Card>

      {routine ? (
        <View style={styles.routine}>
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="routineGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#f97316" />
                <Stop offset="0.45" stopColor="#c2410c" />
                <Stop offset="1" stopColor="#3b1405" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#routineGradient)" />
            <Circle cx="92%" cy="5%" r="70" fill="rgba(255,255,255,0.08)" />
            <Circle cx="78%" cy="110%" r="60" fill="rgba(255,255,255,0.05)" />
          </Svg>
          <Text style={styles.kicker}>TU RUTINA</Text>
          <Text style={styles.routineName}>{routine.name}</Text>
          <Text style={styles.routineSub}>
            {routine.lastDayName
              ? `Último entrenamiento: ${routine.lastDayName}`
              : routine.coachName
                ? `Armada por ${routine.coachName}`
                : "Todavía no la entrenaste"}
          </Text>
          <Pressable
            onPress={() => router.push(`/rutina/${routine.id}`)}
            style={({ pressed }) => [styles.continue, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.continueText}>Continuar</Text>
            <Ionicons name="arrow-forward" size={16} color="#c2410c" />
          </Pressable>
        </View>
      ) : (
        <Card style={[styles.card, { alignItems: "center" }]}>
          <Muted style={{ textAlign: "center" }}>
            Todavía no tenés una rutina. Cuando tu coach te arme una, o crees la tuya, va a
            aparecer acá.
          </Muted>
          <Pressable onPress={() => router.push("/rutinas")} hitSlop={8}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.primary }}>
              Ir a Entrenamiento
            </Text>
          </Pressable>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  big: { fontFamily: fonts.semibold, fontSize: 30, color: colors.foreground },
  bigGoal: { fontFamily: fonts.regular, fontSize: 16, color: colors.mutedForeground },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  dotDone: { backgroundColor: colors.primary },
  dotToday: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
  dotText: { fontFamily: fonts.medium, fontSize: 12, color: colors.mutedForeground },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  goalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.mutedForeground,
  },
  bar: { flex: 1, backgroundColor: colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { fontFamily: fonts.regular, fontSize: 11, color: colors.mutedForeground },
  routine: { borderRadius: 18, overflow: "hidden", padding: 18, gap: 4 },
  kicker: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.75)",
  },
  routineName: { fontFamily: fonts.bold, fontSize: 20, color: "#fff" },
  routineSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 10,
  },
  continue: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  continueText: { fontFamily: fonts.semibold, fontSize: 14, color: "#c2410c" },
});
