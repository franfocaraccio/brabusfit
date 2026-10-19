"use client";

import { useEffect, useRef, useState } from "react";

import { formatAxis, niceScale } from "@brabus/shared";

export type ChartPoint = {
  /** Etiqueta corta del eje X (ej. "18/10"). */
  label: string;
  value: number;
  /** Texto del punto seleccionado (ej. "18/10 · 62,5 kg × 8"). */
  detail: string;
};

const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

/** Ancho real del contenedor (los gráficos se dibujan a ese ancho). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Índices de las etiquetas del eje X que se muestran (máx. ~6, siempre la última). */
function labelIndexes(n: number, max = 6): Set<number> {
  if (n <= max) return new Set(Array.from({ length: n }, (_, i) => i));
  const step = Math.ceil(n / max);
  const out = new Set<number>();
  for (let i = n - 1; i >= 0; i -= step) out.add(i);
  return out;
}

function ChartFrame({
  points,
  zeroBased,
  render,
}: {
  points: ChartPoint[];
  zeroBased: boolean;
  render: (ctx: {
    x: (i: number) => number;
    y: (v: number) => number;
    slot: number;
    selected: number;
  }) => React.ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [selected, setSelected] = useState<number | null>(null);
  const sel = selected !== null && selected < points.length ? selected : points.length - 1;

  const values = points.map((p) => p.value);
  const scale = niceScale(Math.min(...values), Math.max(...values), 4, { zeroBased });
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(points.length, 1);
  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const y = (v: number) =>
    PAD.top + innerH - ((v - scale.min) / (scale.max - scale.min || 1)) * innerH;
  const shown = labelIndexes(points.length);

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground h-4 text-xs">
        {points[sel] ? (
          <span className="text-foreground font-medium">{points[sel].detail}</span>
        ) : null}
      </p>
      <div ref={ref} className="w-full">
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block select-none">
            {scale.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-border"
                  strokeDasharray="3 4"
                />
                <text
                  x={PAD.left - 6}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {formatAxis(t)}
                </text>
              </g>
            ))}
            {render({ x, y, slot, selected: sel })}
            {points.map((p, i) =>
              shown.has(i) ? (
                <text
                  key={i}
                  x={x(i)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {p.label}
                </text>
              ) : null,
            )}
            {/* Zonas táctiles / hover por punto */}
            {points.map((_, i) => (
              <rect
                key={i}
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setSelected(i)}
                onClick={() => setSelected(i)}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

export function LineChart({ points }: { points: ChartPoint[] }) {
  return (
    <ChartFrame
      points={points}
      zeroBased={false}
      render={({ x, y, selected }) => (
        <>
          {points.length > 1 && (
            <polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
              fill="none"
              className="stroke-primary"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r={i === selected ? 5.5 : 3.5}
              className={i === selected ? "fill-primary stroke-background" : "fill-primary"}
              strokeWidth={i === selected ? 2 : 0}
            />
          ))}
        </>
      )}
    />
  );
}

export function BarChart({ points }: { points: ChartPoint[] }) {
  return (
    <ChartFrame
      points={points}
      zeroBased
      render={({ x, y, slot, selected }) => {
        const w = Math.max(Math.min(slot * 0.6, 28), 3);
        return points.map((p, i) => (
          <rect
            key={i}
            x={x(i) - w / 2}
            y={y(p.value)}
            width={w}
            height={Math.max(y(0) - y(p.value), p.value > 0 ? 2 : 0)}
            rx={Math.min(4, w / 2)}
            className={i === selected ? "fill-primary" : "fill-primary/45"}
          />
        ));
      }}
    />
  );
}
