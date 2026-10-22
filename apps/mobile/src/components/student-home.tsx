import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";

import {
  WEEKDAY_INITIALS,
  fitConsistencyGrid,
  monthLabels,
  studentDashboard,
  type WeekSummary,
} from "@brabus/shared";
import type { HomePlan, HomeRoutine } from "@brabus/supabase";

import { Card, Muted } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

/** Inicio del alumno (igual que StudentHome de la web): semana, consistencia, su rutina y su plan. */
export function StudentHome({
  finishedAt,
  routine,
  plan,
}: {
  finishedAt: string[];
  routine: HomeRoutine | null;
  plan: HomePlan | null;
}) {
  const goal = routine && routine.dayCount > 0 ? routine.dayCount : null;
  // La grilla muestra las semanas que entran en el ancho de la tarjeta.
  const [gridWidth, setGridWidth] = useState(0);
  const fit = gridWidth
    ? fitConsistencyGrid(gridWidth, {
        cell: CELL,
        gap: CELL_GAP,
        label: LABEL_W,
      })
    : null;
  const stats = studentDashboard(finishedAt, goal, undefined, fit?.weeks);

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
                style={[
                  styles.dot,
                  done ? styles.dotDone : today ? styles.dotToday : null,
                ]}
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
        <Text style={styles.label}>Consistencia</Text>
        <View style={styles.consistency}>
          <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {fit ? (
              <ConsistencyGrid weeks={stats.weeks} cell={fit.cell} />
            ) : (
              <View style={{ height: GRID_H }} />
            )}
          </View>
          <View style={styles.consistencyStats}>
            <Stat
              label="Promedio"
              value={
                stats.average === null
                  ? "—"
                  : `${stats.average.toLocaleString("es-AR", { maximumFractionDigits: 1 })} / sem`
              }
            />
            {goal ? (
              <Stat
                label="Racha"
                value={`${stats.streak} ${stats.streak === 1 ? "semana" : "semanas"}`}
              />
            ) : null}
          </View>
        </View>
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
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#routineGradient)"
            />
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
            style={({ pressed }) => [
              styles.continue,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.continueText}>Continuar</Text>
            <Ionicons name="arrow-forward" size={16} color="#c2410c" />
          </Pressable>
        </View>
      ) : (
        <Card style={[styles.card, { alignItems: "center" }]}>
          <Muted style={{ textAlign: "center" }}>
            Todavía no tenés una rutina. Cuando tu coach te arme una, o crees la
            tuya, va a aparecer acá.
          </Muted>
          <Pressable onPress={() => router.push("/rutinas")} hitSlop={8}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.primary }}>
              Ir a Entrenamiento
            </Text>
          </Pressable>
        </Card>
      )}

      {plan ? <PlanCard plan={plan} /> : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Text style={[styles.label, { fontSize: 13 }]}>
      {label} <Text style={styles.statValue}>{value}</Text>
    </Text>
  );
}

/** Grilla tipo GitHub: una columna por semana, una fila por día (L a D). */
function ConsistencyGrid({
  weeks,
  cell,
}: {
  weeks: WeekSummary[];
  cell: number;
}) {
  const months = monthLabels(weeks);
  return (
    <View style={styles.grid}>
      <View style={styles.gridRow}>
        <View style={styles.gridLabel} />
        {weeks.map((w, wi) => (
          <View key={wi} style={[styles.gridMonthBox, { width: cell }]}>
            <Text style={styles.gridMonth}>{months[wi]}</Text>
          </View>
        ))}
      </View>
      {WEEKDAY_INITIALS.map((d, di) => (
        <View key={di} style={styles.gridRow}>
          <Text style={[styles.gridLabel, { lineHeight: cell }]}>
            {di % 2 === 0 ? d : ""}
          </Text>
          {weeks.map((w, wi) => {
            const state = w.daily[di];
            return (
              <View
                key={wi}
                style={[
                  styles.cell,
                  { width: cell, height: cell },
                  state === "done"
                    ? { backgroundColor: colors.primary }
                    : state === "rest"
                      ? { backgroundColor: colors.muted }
                      : { borderWidth: 1, borderColor: colors.muted },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const MACROS = [
  { key: "protein", label: "Proteínas", kcalPerGram: 4, color: colors.primary },
  { key: "carbs", label: "Carbohidratos", kcalPerGram: 4, color: "#38bdf8" },
  { key: "fat", label: "Grasas", kcalPerGram: 9, color: "#a78bfa" },
] as const;

/** "Tu plan": el plan de nutrición vigente, con calorías, macros y comidas. */
function PlanCard({ plan }: { plan: HomePlan }) {
  const macros = plan.macros;
  const total = macros
    ? MACROS.reduce((sum, m) => sum + macros[m.key] * m.kcalPerGram, 0)
    : 0;

  return (
    <Card style={[styles.card, { padding: 18 }]}>
      <View style={[styles.rowBetween, { alignItems: "flex-start" }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>
            TU PLAN
          </Text>
          <Text style={styles.planName} numberOfLines={1}>
            {plan.name}
          </Text>
          {plan.coachName ? (
            <Text style={styles.label}>Armado por {plan.coachName}</Text>
          ) : null}
        </View>
        <Ionicons name="nutrition-outline" size={20} color={colors.primary} />
      </View>

      {plan.kcal ? (
        <Text style={[styles.big, { fontSize: 24 }]}>
          {plan.kcal}
          <Text style={[styles.bigGoal, { fontSize: 13 }]}> kcal por día</Text>
        </Text>
      ) : null}

      {macros && total > 0 ? (
        <View style={{ gap: 8 }}>
          <View style={styles.macroBar}>
            {MACROS.map((m) => (
              <View
                key={m.key}
                style={{
                  flex: macros[m.key] * m.kcalPerGram,
                  backgroundColor: m.color,
                }}
              />
            ))}
          </View>
          <View style={styles.legend}>
            {MACROS.map((m) => (
              <View key={m.key} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: m.color }]}
                />
                <Text style={styles.label}>
                  {m.label}{" "}
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      color: colors.foreground,
                    }}
                  >
                    {Math.round(macros[m.key])} g
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {plan.meals.length > 0 ? (
        <Text style={[styles.label, { fontSize: 13 }]}>
          {plan.meals.length} {plan.meals.length === 1 ? "comida" : "comidas"}:{" "}
          {plan.meals.join(" · ")}
        </Text>
      ) : null}

      <Pressable
        onPress={() => router.push(`/nutricion/${plan.id}`)}
        hitSlop={8}
        style={styles.planLink}
        accessibilityRole="button"
      >
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 14,
            color: colors.primary,
          }}
        >
          Ver plan
        </Text>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </Pressable>
    </Card>
  );
}

const CELL = 14;
const CELL_GAP = 3;
const LABEL_W = 12;
/** Alto de la grilla (meses + 7 filas) mientras se mide el ancho. */
const GRID_H = 13 + 7 * (CELL + CELL_GAP);

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  big: { fontFamily: fonts.semibold, fontSize: 30, color: colors.foreground },
  bigGoal: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  dotDone: { backgroundColor: colors.primary },
  dotToday: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dotText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  consistency: { gap: 14 },
  consistencyStats: { flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 4 },
  statValue: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.foreground,
  },
  grid: { gap: CELL_GAP },
  gridRow: { flexDirection: "row", alignItems: "center", gap: CELL_GAP },
  gridLabel: {
    width: LABEL_W,
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.mutedForeground,
  },
  gridMonthBox: { height: 13 },
  gridMonth: {
    position: "absolute",
    left: 0,
    width: 30,
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.mutedForeground,
  },
  cell: { borderRadius: 3 },
  axis: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.mutedForeground,
  },
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
  planName: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.foreground,
    marginTop: 2,
  },
  macroBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  planLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
});
