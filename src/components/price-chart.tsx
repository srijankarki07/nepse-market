"use client";

/**
 * A closing-price chart, with the session's high–low range behind it.
 *
 * ## Why there is no candlestick
 *
 * Recharts has none, and pulling in a second charting library for one chart is not worth
 * the weight. It is also a poor fit for this data: the archive is end-of-day, so every
 * bar would be a single point wide, and a candlestick of one tick is a line with a
 * shadow. A close line over a high–low band says the same thing and reads better at a
 * glance — the band is the day's range, the line is where it settled.
 *
 * ## Missing days leave gaps rather than zeroes
 *
 * The series holds only sessions the scrip actually traded, so the x axis is categorical:
 * a scrip suspended for a month shows a straight line across the gap, not a plunge to
 * zero. `connectNulls` is off and there are no nulls to connect — the points simply do
 * not exist, which is the honest depiction of a market that was not open for it.
 */

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { price, sessionDate } from "@/lib/format";
import type { SeriesPoint } from "@/lib/market";

export function PriceChart({ points }: { points: readonly SeriesPoint[] }) {
  // Recharts wants a mutable array and a stable identity per point.
  const data = points.map((point) => ({
    label: point.label,
    close: point.close,
    // The band is drawn from a baseline to the high, then a second band downward to the
    // low. Recharts' range Area takes a two-element dataKey for exactly this.
    range: point.low === null || point.high === null ? null : [point.low, point.high],
  }));

  if (data.length < 2) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
        Not enough sessions in this range to draw a chart.
      </p>
    );
  }

  return (
    <div className="h-80 w-full rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickFormatter={(value: string) => value.slice(5)}
            minTickGap={40}
            stroke="currentColor"
            opacity={0.6}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            width={64}
            stroke="currentColor"
            opacity={0.6}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active !== true || payload === undefined || payload.length === 0) return null;
              const point = payload[0]?.payload as
                | { close: number | null; range: [number, number] | null }
                | undefined;
              if (point === undefined) return null;

              return (
                <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
                  <p className="font-medium">{sessionDate(String(label))}</p>
                  <p className="tabular-nums">Close {price(point.close)}</p>
                  {point.range !== null && (
                    <p className="tabular-nums text-neutral-500 dark:text-neutral-400">
                      Range {price(point.range[0])} – {price(point.range[1])}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="range"
            stroke="none"
            fill="currentColor"
            opacity={0.12}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#2563eb"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
