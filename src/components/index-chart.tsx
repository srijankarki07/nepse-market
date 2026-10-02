"use client";

/**
 * The equal-weighted market index over time.
 *
 * ## One series, no legend
 *
 * There is one line, so there is nothing to tell apart and a legend box would restate the
 * title. The colour carries direction — green when the period closed up, red when it
 * closed down — and that reading is duplicated in the heading above the chart, so the
 * colour is never the only place the answer lives.
 *
 * ## Grid and axes are hairlines, not dashes
 *
 * Dashed gridlines read as a threshold or a projection when they are only a grid. The
 * grid here is one step off the surface and solid.
 *
 * ## The tooltip enhances; it does not gate
 *
 * Every value is also reachable from the table below the chart, and the extremes are
 * labelled directly. A reader who never hovers misses nothing.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { sessionDate } from "@/lib/format";
import type { IndexPoint, MarketIndex } from "@/lib/index-series";
import { indexExtremes } from "@/lib/index-series";

export function IndexChart({ index }: { index: MarketIndex }) {
  const { high, low } = indexExtremes(index);

  // Direction over the period decides the hue. `null` — a single point — is neither, and
  // gets the muted ink rather than a colour that would claim a move.
  const up = index.changePercent !== null && index.changePercent > 0;
  const flat = index.changePercent === null || index.changePercent === 0;
  const stroke = flat ? "var(--flat)" : up ? "var(--up)" : "var(--down)";

  if (index.points.length < 2) {
    return (
      <p className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
        Not enough sessions in this range to draw the index.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={index.points}
          margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
          // The draw is a one-shot reveal, not a loop. A chart that redraws itself while
          // somebody is reading it is a distraction.
          className="animate-fade"
        >
          <defs>
            <linearGradient id="index-fill" x1="0" y1="0" x2="0" y2="1">
              {/* A wash, never a saturated block — the line is the data. */}
              <stop offset="0%" stopColor={stroke} stopOpacity={0.16} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickFormatter={(value: string) => value.slice(5)}
            minTickGap={48}
            axisLine={{ stroke: "var(--axis)" }}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            width={52}
            tickFormatter={(value: number) => value.toFixed(1)}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (active !== true || payload === undefined || payload.length === 0) return null;
              const point = payload[0]?.payload as IndexPoint | undefined;
              if (point === undefined) return null;

              const change = point.value - 100;

              return (
                <div className="rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">{sessionDate(point.date)}</p>
                  <p className="tabular">Index {point.value.toFixed(2)}</p>
                  <p className="tabular text-[var(--ink-2)]">
                    {change >= 0 ? "+" : "−"}
                    {Math.abs(change).toFixed(2)} since {sessionDate(index.points[0]?.date ?? "")}
                  </p>
                  <p className="text-[var(--muted)]">{point.constituents} scrips</p>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#index-fill)"
            dot={false}
            isAnimationActive={false}
          />

          {/* The extremes are labelled directly rather than left to the axis and the
              tooltip — they are the two points a reader looks for first. */}
          {high !== null && (
            <ReferenceDot
              x={high.date}
              y={high.value}
              r={4}
              fill={stroke}
              stroke="var(--surface)"
              strokeWidth={2}

            />
          )}
          {low !== null && (
            <ReferenceDot
              x={low.date}
              y={low.value}
              r={4}
              fill={stroke}
              stroke="var(--surface)"
              strokeWidth={2}

            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * The chart's table twin.
 *
 * Every chart on this site has one. It is what makes the chart's colour optional: a
 * reader who cannot separate the hues, or who is using a screen reader, gets the same
 * numbers in the same order.
 */
export function IndexTable({ index }: { index: MarketIndex }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--ink-2)]">
        View as a table
      </summary>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-[var(--hairline)]">
        <table className="w-full">
          <caption className="sr-only">Equal-weighted index level by session</caption>
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr className="border-b border-[var(--hairline)] text-left">
              <th scope="col" className="px-3 py-1.5 font-medium">Session</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Index</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Scrips</th>
            </tr>
          </thead>
          <tbody>
            {index.points.map((point) => (
              <tr key={point.date} className="border-b border-[var(--hairline)] last:border-0">
                <td className="px-3 py-1.5">{sessionDate(point.date)}</td>
                <td className="tabular px-3 py-1.5 text-right">{point.value.toFixed(2)}</td>
                <td className="tabular px-3 py-1.5 text-right text-[var(--muted)]">
                  {point.constituents}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
