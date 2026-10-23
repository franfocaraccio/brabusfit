import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  buildProgress,
  DEFAULT_PERIOD,
  PERIODS,
  type ChartSpec,
  type Period,
  type ProgressSession,
} from "@brabus/shared";

import { BarChart, LineChart } from "@/components/charts";
import { Segmented } from "@/components/segmented";
import { OptionList, Sheet } from "@/components/sheet";
import { Card, Muted } from "@/components/ui";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

/**
 * Gráficos de evolución (igual que ProgressView de la web): ejercicio,
 * período, récords, peso máximo, volumen y frecuencia semanal.
 */
export function ProgressView({
  sessions,
  emptyText = "Todavía no hay entrenamientos guardados. Cuando guardes una sesión, acá vas a ver tu evolución.",
}: {
  sessions: ProgressSession[];
  emptyText?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [key, setKey] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [picker, setPicker] = useState(false);
  const { exercises, selected, records, charts, frequency } = buildProgress(
    sessions,
    key,
    period,
  );

  if (!selected) {
    return (
      <Card style={styles.empty}>
        <Ionicons name="trending-up" size={32} color={colors.mutedForeground} />
        <Muted style={{ textAlign: "center" }}>{emptyText}</Muted>
      </Card>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <Pressable
        onPress={() => setPicker(true)}
        style={styles.select}
        accessibilityRole="button"
        accessibilityLabel="Elegir ejercicio"
      >
        <Ionicons
          name="barbell-outline"
          size={18}
          color={colors.mutedForeground}
        />
        <Text style={styles.selectText} numberOfLines={1}>
          {selected.name}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>

      <Segmented
        value={period}
        onChange={setPeriod}
        options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
      />

      {records.length > 0 && (
        <View style={styles.records}>
          {records.map((r) => (
            <Card key={r.label} style={styles.record}>
              <Text style={styles.recordLabel}>{r.label}</Text>
              <Text style={styles.recordValue}>{r.value}</Text>
              <Text style={styles.recordDetail}>{r.detail}</Text>
            </Card>
          ))}
        </View>
      )}

      <ChartCard spec={charts.main} kind="line" />
      <ChartCard spec={charts.volume} kind="bar" />
      <ChartCard spec={frequency} kind="bar" />

      <Sheet
        visible={picker}
        onClose={() => setPicker(false)}
        title="Ejercicio"
      >
        <OptionList
          value={selected.key}
          options={exercises.map((e) => ({ value: e.key, label: e.name }))}
          onSelect={(v) => {
            setKey(v);
            setPicker(false);
          }}
        />
      </Sheet>
    </View>
  );
}

function ChartCard({ spec, kind }: { spec: ChartSpec; kind: "line" | "bar" }) {
  const styles = useStyles();
  return (
    <Card style={styles.chartCard}>
      <View>
        <Text style={styles.chartTitle}>{spec.title}</Text>
        <Text style={styles.chartSubtitle}>{spec.subtitle}</Text>
      </View>
      {spec.points.length === 0 ? (
        <Muted style={{ textAlign: "center", paddingVertical: 20 }}>
          Sin datos en este período.
        </Muted>
      ) : kind === "line" ? (
        <LineChart points={spec.points} />
      ) : (
        <BarChart points={spec.points} />
      )}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  empty: { padding: 24, alignItems: "center", gap: 10 },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.field,
  },
  selectText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.foreground,
  },
  records: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  record: { flexGrow: 1, flexBasis: "45%", padding: 12, gap: 2 },
  recordLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  recordValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.foreground,
  },
  recordDetail: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  chartCard: { padding: 14, gap: 8 },
  chartTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.foreground,
  },
  chartSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
}));
