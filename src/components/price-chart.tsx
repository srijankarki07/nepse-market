"use client";

/**
 * A closing-price chart, with a volume histogram beneath it and each session's high–low
 * range banded behind the line.
 *
 * ## Why there is no candlestick
 *
 * Recharts has none, and pulling in a second charting library for one chart is not worth
 * the weight. It is also the wrong shape for this data: end-of-day means every bar would
 * be a single tick wide, so a candlestick would be a line with a shadow. A close line over
 * a range band says the same thing and reads better, the band is the day's range, the
 * line is where it settled.
 *
 * ## The colour is the period's direction, and it is not the only place that is said
 *
 * Green when the scrip closed the period up, red when it closed down, muted when it did
 * not move. The heading above the chart states the same change in figures, signed, so a
 * reader who cannot separate the two hues loses nothing.
 *
 * ## Volume rides its own axis, drawn small
 *
 * Volume is a different quantity from price, so it gets a second, hidden axis rather than
 * a share of the price scale. That axis' top sits four times the busiest session, which
 * puts the tallest bar at a quarter of the height: legible, but never competing with the
 * line, and never implying that a heavy session is why the price moved.
 *
 * ## Missing sessions leave gaps, not zeroes
 *
 * The series holds only the sessions the scrip actually traded, and the x axis is
 * categorical: a scrip suspended for a month shows a gap in the points, never a plunge to
 * zero. `connectNulls` is off and there are no nulls to connect, the points simply do
 * not exist, which is the honest depiction of a market that was not open for it. Volume
 * follows the same rule: a session the archive publishes without a figure draws no bar,
 * since a bar at the baseline would say it traded nothing, which is not what a missing
 * figure means.
 */

import {
  Area,
  Bar,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { price, sessionDate, signed, percent, volume } from "@/lib/format";
import type { SeriesPoint } from "@/lib/market";

/** The chart's own row, the shape the tooltip reads back off the cursor. */
interface ChartRow {
  date: string;
  label: string;
  close: number | null;
  range: [number, number] | null;
  volume: number | null;
}

/**
 * The volume axis' top, as a multiple of the busiest session.
 *
 * Above one so the bars sit low: at four the tallest reaches a quarter of the height.
 */
const VOLUME_HEADROOM = 4;

export function PriceChart({ points }: { points: readonly SeriesPoint[] }) {
  // Recharts wants its own array, and the range band needs both ends present.
  const data: ChartRow[] = points.map((point) => ({
    date: point.date,
    label: point.label,
    close: point.close,
    // A two-element key is how a range Area is expressed: baseline to high, then low.
    range: point.low === null || point.high === null ? null : [point.low, point.high],
    // Left as `null`, never `0`: a zero bar would claim the session traded nothing.
    volume: point.volume,
  }));

  if (data.length < 2) {
    return (
      <p className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
        Not enough sessions in this range to draw a chart.
      </p>
    );
  }

  const first = points[0]?.close ?? null;
  const last = points.at(-1)?.close ?? null;
  const rose = first !== null && last !== null && last > first;
  const fell = first !== null && last !== null && last < first;
  const stroke = rose ? "var(--up)" : fell ? "var(--down)" : "var(--flat)";

  const closes = points.map((point) => point.close).filter((value): value is number => value !== null);
  const high = closes.length === 0 ? null : Math.max(...closes);
  const low = closes.length === 0 ? null : Math.min(...closes);
  const highPoint = points.find((point) => point.close === high) ?? null;
  const lowPoint = points.find((point) => point.close === low) ?? null;

  const traded = points
    .map((point) => point.volume)
    .filter((value): value is number => value !== null && value > 0);
  const busiest = traded.length === 0 ? null : Math.max(...traded);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.14} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* Solid hairlines. Dashed gridlines read as a threshold or a projection when
              they are only a grid. */}
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickFormatter={(value: string) => value.slice(5)}
            minTickGap={44}
            axisLine={{ stroke: "var(--axis)" }}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            width={56}
            tickFormatter={(value: number) => value.toFixed(0)}
            axisLine={false}
            tickLine={false}
          />

          {/* Hidden: the bars need a scale, not a set of labels. A second visible axis
              would restate in ticks what the tooltip and the table say in figures. */}
          {busiest !== null && (
            <YAxis yAxisId="volume" hide domain={[0, busiest * VOLUME_HEADROOM]} />
          )}

          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (active !== true || payload === undefined || payload.length === 0) return null;
              const row = payload[0]?.payload as ChartRow | undefined;
              if (row === undefined) return null;

              return (
                <div className="rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">{sessionDate(row.date)}</p>
                  <p className="tabular">Close {price(row.close)}</p>
                  {row.range !== null && (
                    <p className="tabular text-[var(--ink-2)]">
                      Range {price(row.range[0])} – {price(row.range[1])}
                    </p>
                  )}
                  <p className="tabular text-[var(--muted)]">Volume {volume(row.volume)}</p>
                </div>
              );
            }}
          />

          {/* The day's range, as a flat wash sitting behind everything. */}
          <Area
            type="monotone"
            dataKey="range"
            stroke="none"
            fill="var(--muted)"
            opacity={0.14}
            isAnimationActive={false}
          />

          {/*
            The area under the close line, filled with the same gradient the home page's
            index uses. Two reasons it is here rather than a flat tint: it ties the two
            charts into one system, and the fade gives the line something to sit on: a
            bare stroke over a range band reads as a wire crossing a smudge.
          */}
          <Area
            type="monotone"
            dataKey="close"
            stroke="none"
            fill="url(#price-fill)"
            isAnimationActive={false}
          />

          {/* Drawn after the washes so it reads through them, and before the line so the
              price stays on top. `null` days simply have no rectangle. */}
          {busiest !== null && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="var(--axis)"
              fillOpacity={0.35}
              radius={[1, 1, 0, 0]}
              isAnimationActive={false}
            />
          )}

          <Line
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          {/* Labelled directly: these are the two points a reader looks for, and the
              axis alone does not say when they happened. */}
          {highPoint !== null && highPoint.close !== null && (
            <ReferenceDot
              x={highPoint.label}
              y={highPoint.close}
              r={4}
              fill={stroke}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}
          {lowPoint !== null && lowPoint.close !== null && lowPoint.date !== highPoint?.date && (
            <ReferenceDot
              x={lowPoint.label}
              y={lowPoint.close}
              r={4}
              fill={stroke}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * The chart's table twin, so no value is reachable only by hovering.
 *
 * The volume column is not decoration: the tooltip now reports a session's shares
 * traded, and the rule on this site is that the table carries every field the tooltip
 * does, so a reader who never hovers is missing nothing.
 */
export function PriceTable({ points }: { points: readonly SeriesPoint[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--ink-2)]">
        View as a table
      </summary>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-[var(--hairline)]">
        <table className="w-full">
          <caption className="sr-only">Closing price and volume by session</caption>
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr className="border-b border-[var(--hairline)] text-left">
              <th scope="col" className="px-3 py-1.5 font-medium">Session</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Open</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">High</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Low</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Close</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Volume</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((point) => (
              <tr key={point.date} className="border-b border-[var(--hairline)] last:border-0">
                <td className="px-3 py-1.5">{sessionDate(point.date)}</td>
                <td className="tabular px-3 py-1.5 text-right">{price(point.open)}</td>
                <td className="tabular px-3 py-1.5 text-right">{price(point.high)}</td>
                <td className="tabular px-3 py-1.5 text-right">{price(point.low)}</td>
                <td className="tabular px-3 py-1.5 text-right">{price(point.close)}</td>
                <td className="tabular px-3 py-1.5 text-right text-[var(--muted)]">
                  {volume(point.volume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** The period's change, signed, the figures the chart's colour is restating. */
export function SeriesChange({ points }: { points: readonly SeriesPoint[] }) {
  const first = points[0]?.close ?? null;
  const last = points.at(-1)?.close ?? null;
  if (first === null || last === null || first === 0) return null;

  const change = last - first;
  const changePercent = (change / first) * 100;
  // The `-ink` tokens: this is a written figure, signed, not a mark to be told apart from
  // another mark. See the palette note in globals.css.
  const className =
    change > 0
      ? "text-[var(--up-ink)]"
      : change < 0
        ? "text-[var(--down-ink)]"
        : "text-[var(--flat-ink)]";

  return (
    <span className={`tabular font-medium ${className}`}>
      {signed(change)} ({percent(changePercent)})
    </span>
  );
}
