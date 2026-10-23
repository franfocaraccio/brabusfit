import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import { formatAxis, niceScale, type ChartData } from "@brabus/shared";

import { fonts, makeStyles, useColors } from "@/lib/theme";

const HEIGHT = 180;
const PAD = { top: 12, right: 10, bottom: 24, left: 38 };

/** Índices de las etiquetas del eje X que se muestran (máx. ~5, siempre la última). */
function labelIndexes(n: number, max = 5): Set<number> {
  if (n <= max) return new Set(Array.from({ length: n }, (_, i) => i));
  const step = Math.ceil(n / max);
  const out = new Set<number>();
  for (let i = n - 1; i >= 0; i -= step) out.add(i);
  return out;
}

/** Marco común: ejes, etiquetas, punto seleccionado (tocando) y detalle arriba. */
function ChartFrame({
  points,
  zeroBased,
  render,
}: {
  points: ChartData[];
  zeroBased: boolean;
  render: (ctx: {
    x: (i: number) => number;
    y: (v: number) => number;
    slot: number;
    selected: number;
  }) => React.ReactNode;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const sel =
    selected !== null && selected < points.length
      ? selected
      : points.length - 1;

  const values = points.map((p) => p.value);
  const scale = niceScale(Math.min(...values), Math.max(...values), 4, {
    zeroBased,
  });
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(points.length, 1);
  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const y = (v: number) =>
    PAD.top +
    innerH -
    ((v - scale.min) / (scale.max - scale.min || 1)) * innerH;
  const shown = labelIndexes(points.length);

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.detail}>{points[sel]?.detail ?? " "}</Text>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {scale.ticks.map((t) => (
              <G key={t}>
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={colors.border}
                  strokeDasharray="3 4"
                />
                <SvgText
                  x={PAD.left - 6}
                  y={y(t) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fontFamily={fonts.regular}
                  fill={colors.mutedForeground}
                >
                  {formatAxis(t)}
                </SvgText>
              </G>
            ))}
            {render({ x, y, slot, selected: sel })}
            {points.map((p, i) =>
              shown.has(i) ? (
                <SvgText
                  key={`l${i}`}
                  x={x(i)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily={fonts.regular}
                  fill={colors.mutedForeground}
                >
                  {p.label}
                </SvgText>
              ) : null,
            )}
          </Svg>
        )}
        {/* Zonas táctiles por punto (encima del gráfico) */}
        {width > 0 && (
          <View
            style={[
              styles.touchRow,
              { left: PAD.left, top: PAD.top, height: innerH },
            ]}
          >
            {points.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setSelected(i)}
                style={{ width: slot, height: "100%" }}
                accessibilityLabel={points[i].detail}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export function LineChart({ points }: { points: ChartData[] }) {
  const colors = useColors();
  return (
    <ChartFrame
      points={points}
      zeroBased={false}
      render={({ x, y, selected }) => (
        <>
          {points.length > 1 && (
            <Polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r={i === selected ? 5.5 : 3.5}
              fill={colors.primary}
              stroke={i === selected ? colors.background : "none"}
              strokeWidth={i === selected ? 2 : 0}
            />
          ))}
        </>
      )}
    />
  );
}

export function BarChart({ points }: { points: ChartData[] }) {
  const colors = useColors();
  return (
    <ChartFrame
      points={points}
      zeroBased
      render={({ x, y, slot, selected }) => {
        const w = Math.max(Math.min(slot * 0.6, 26), 3);
        return points.map((p, i) => (
          <Rect
            key={i}
            x={x(i) - w / 2}
            y={y(p.value)}
            width={w}
            height={Math.max(y(0) - y(p.value), p.value > 0 ? 2 : 0)}
            rx={Math.min(4, w / 2)}
            fill={colors.primary}
            opacity={i === selected ? 1 : 0.45}
          />
        ));
      }}
    />
  );
}

const useStyles = makeStyles((colors) => ({
  detail: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.foreground,
    minHeight: 17,
  },
  touchRow: { position: "absolute", flexDirection: "row" },
}));
