/**
 * The shared furniture: the pieces every screen in the redesign is built from.
 *
 * ## Avatars are monograms, and their hue is deliberately constrained
 *
 * The references put a company mark beside every ticker, which is what makes a long table
 * scannable. There is no logo in any source this project holds (checked ShareSansar's
 * market page and a company page: the images are adverts and app-store badges), so these
 * are initials.
 *
 * Their colour is derived from the ticker, so a scrip looks the same everywhere, and the
 * hue is held to the **cool half of the wheel, 180° to 300°**. That is the whole point of
 * deriving it this way rather than hashing into all 360: the palette's green and pink at
 * the warm end already mean *up* and *down*, and an avatar that happened to be green would
 * read as a fact about the scrip rather than as its name. Colour on this page means
 * exactly one of three things, and an avatar is none of them, so it stays out of their way.
 *
 * ## The sparkline is an SVG, not a chart
 *
 * The market table renders every listed scrip. Three hundred Recharts instances would be
 * unusable, so this is one hand-built path per row with no axes, no tooltip and no
 * interaction. It is also `aria-hidden`: the change it draws is stated in figures beside
 * it, and a screen reader gains nothing from being told about a polyline.
 */

import { useState, type ReactNode } from "react";

import { percent, price, sessionDate } from "@/lib/format";

/* -------------------------------------------------------------------------- avatars */

/**
 * A stable hue for a ticker, in the cool half of the wheel.
 *
 * Exported because it is the one part of the avatar worth asserting on: two tickers that
 * hash to the same hue are a cosmetic coincidence, but a hue that wandered into the green
 * or pink range would be a design regression.
 */
export function hueFor(symbol: string): number {
  let hash = 0;
  for (let index = 0; index < symbol.length; index++) {
    hash = (hash * 31 + symbol.charCodeAt(index)) % 100_000;
  }
  return 180 + (hash % 120);
}

/** The initials to draw: the first two characters that are actually part of a ticker. */
export function monogramFor(symbol: string): string {
  const letters = symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  return letters === "" ? "?" : letters;
}

export function Avatar({
  symbol,
  size = 28,
  className = "",
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-mono font-semibold tracking-tight ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        // Mixed into the surface so one expression serves both themes: on a light page it
        // is a pale tint, on the dark one a low wash, with no second token to maintain.
        background: `color-mix(in oklab, oklch(0.62 0.13 ${hueFor(symbol)}) 28%, var(--surface))`,
        color: "var(--ink-2)",
      }}
    >
      {monogramFor(symbol)}
    </span>
  );
}

/* ------------------------------------------------------------------------ sparklines */

/** The path for a sparkline, or `""` when there is nothing to draw a line through. */
export function sparkPath(
  values: readonly number[],
  width: number,
  height: number,
  padding = 1.5,
): string {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) return "";

  const low = Math.min(...clean);
  const high = Math.max(...clean);
  const span = high - low;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return clean
    .map((value, index) => {
      const x = padding + (index * usableWidth) / (clean.length - 1);
      // A flat series sits on the middle line rather than along the floor, which is what
      // dividing by a zero span would otherwise do.
      const ratio = span === 0 ? 0.5 : (value - low) / span;
      const y = padding + (1 - ratio) * usableHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * The index of the point nearest a pointer, or `-1` when there is nothing to point at.
 *
 * Exported and pure because it is the part of the hover that can be wrong in a way nobody
 * notices: off by one and the tooltip reports the neighbouring day's price, which looks
 * entirely plausible. The inverse of the x-mapping `sparkPath` draws with.
 */
export function nearestIndex(
  count: number,
  pointerX: number,
  width: number,
  padding = 1.5,
): number {
  if (count < 1) return -1;
  if (count === 1) return 0;

  const usable = width - padding * 2;
  if (usable <= 0) return 0;

  const ratio = (pointerX - padding) / usable;
  return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
}

/** One point of a sparkline: a close, and the session it belongs to. */
export interface TrendPoint {
  readonly date: string;
  readonly close: number;
}

export function Sparkline({
  symbol,
  points,
  width = 76,
  height = 24,
  className = "",
}: {
  symbol: string;
  points: readonly TrendPoint[];
  width?: number;
  height?: number;
  className?: string;
}) {
  /*
   * The hovered point lives here rather than in the table, and the tooltip is drawn from
   * here too. A shared tooltip needed the pointer coordinates lifted into the table's state,
   * and an element positioned inside a scroll container is clipped at the table's edges,
   * which is why this one is `fixed` and positioned from the viewport.
   */
  const [active, setActive] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const values = points.map((point) => point.close);
  const path = sparkPath(values, width, height);
  if (path === "") return null;

  const stroke =
    values[values.length - 1]! > values[0]!
      ? "var(--up)"
      : values[values.length - 1]! < values[0]!
        ? "var(--down)"
        : "var(--flat)";

  const hovered: TrendPoint | null = active === null ? null : (points[active] ?? null);

  /** The x a point is drawn at, so the marker and the pointer agree. */
  const xOf = (index: number) => 1.5 + (index * (width - 3)) / Math.max(1, points.length - 1);

  return (
    <span className={`relative inline-flex ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Trend from ${points[0]?.close ?? 0} to ${values[values.length - 1] ?? 0}`}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          // Scaled, because the SVG is drawn at its viewBox size but can be laid out at
          // another width by the browser.
          const scale = width / box.width;
          const index = nearestIndex(points.length, (event.clientX - box.left) * scale, width);

          // Only when the day changes. A tooltip that re-rendered on every pixel of pointer
          // movement would be a state update per frame for no visible gain.
          if (index !== active) {
            setActive(index);
            setAnchor({ x: event.clientX, y: box.top });
          }
        }}
        onPointerLeave={() => {
          setActive(null);
          setAnchor(null);
        }}
      >
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hovered !== null && active !== null && (
          <circle
            cx={xOf(active)}
            cy={yOfPoint(values, active, height)}
            r={2.5}
            fill={stroke}
            stroke="var(--surface)"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {hovered !== null && anchor !== null && (
        <span
          className="tabular pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[135%] rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[11px] font-normal whitespace-nowrap"
          style={{ left: anchor.x, top: anchor.y }}
        >
          <span className="font-mono font-semibold">{symbol}</span>{" "}
          <span className="text-[var(--muted)]">{sessionDate(hovered.date)}</span>{" "}
          <span className="font-medium">{price(hovered.close)}</span>
        </span>
      )}
    </span>
  );
}

/** The y a point is drawn at. Shared by the path and the hover marker so they cannot drift. */
function yOfPoint(values: readonly number[], index: number, height: number, padding = 1.5): number {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low;
  const ratio = span === 0 ? 0.5 : ((values[index] ?? low) - low) / span;
  return padding + (1 - ratio) * (height - padding * 2);
}

/* ---------------------------------------------------------------------------- chips */

/**
 * A change in a tinted chip.
 *
 * It takes the **percentage**, not the absolute change. Those are different numbers and the
 * chip is the percent column: passing the absolute change prints a scrip that fell from
 * 49,000 to 48,000 as "-1000.00%", which is what this looked like before it was caught on
 * screen. The sign is always drawn, so colour is never the only channel.
 */
export function Chip({
  changePercent,
  size = "md",
  className = "",
}: {
  changePercent: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const change = changePercent;
  const up = change !== null && change > 0;
  const down = change !== null && change < 0;

  // The tint is the mark colour and the text is the ink colour, which in the dark theme are
  // the same value and in the light theme are not. The tint is a background and only has to
  // be visible; the text has to be readable on it, and the mark green is not.
  const tone = up ? "var(--up)" : down ? "var(--down)" : "var(--flat)";
  const ink = up ? "var(--up-ink)" : down ? "var(--down-ink)" : "var(--flat-ink)";
  const text = percent(change);

  return (
    <span
      className={`tabular inline-flex items-center justify-end rounded-md font-medium ${
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
      } ${className}`}
      style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)`, color: ink }}
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------------ segmented */

export interface SegmentedOption<T> {
  readonly value: T;
  readonly label: string;
}

/**
 * The range and timeframe control.
 *
 * A radio group rather than a row of buttons, because that is what it is: one of these is
 * always chosen. `aria-pressed` on buttons would describe a set of toggles, which would
 * let a reader believe none or several could be on.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-lg border border-[var(--hairline)] bg-[var(--plane)] p-0.5 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-[var(--accent)] text-[var(--plane)]"
                : "text-[var(--ink-2)] hover:bg-[var(--grid)] hover:text-[var(--ink)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- stat tiles */

/**
 * A labelled figure.
 *
 * `tone` tints both the figure and the card, which is how a row of these reads as a market
 * summary rather than as six unrelated numbers. It is a second channel throughout: the
 * label says what the figure is, so the tint is never the only thing distinguishing
 * "Advanced" from "Declined".
 */
export function StatTile({
  icon,
  label,
  value,
  note,
  tone = "neutral",
  className = "",
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "up" | "down" | "flat" | "neutral" | "accent";
  className?: string;
}) {
  // The tint comes off the mark colour and the figure off the ink colour, which differ only
  // in the light theme. See the palette note in globals.css: the light mark green is chosen
  // to stay separable from the red, not to be read at 20px on its own tint, and it manages
  // the second job at 3.01 rather than the 4.5 a figure this size needs.
  const mark =
    tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : tone === "accent" ? "var(--accent)" : "var(--ink)";

  const ink =
    tone === "up"
      ? "var(--up-ink)"
      : tone === "down"
        ? "var(--down-ink)"
        : tone === "flat"
          ? "var(--flat-ink)"
          : mark;

  // Tinted by mixing into the surface, the same expression the avatars use, so one rule
  // works in both themes without a second set of tokens.
  const background =
    tone === "neutral" ? "var(--surface)" : `color-mix(in oklab, ${mark} 8%, var(--surface))`;

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-xl border border-[var(--hairline)] p-4 ${className}`}
      style={{ background }}
    >
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="tabular text-xl font-semibold tracking-tight" style={{ color: ink }}>
        {value}
      </p>
      {note !== undefined && <p className="text-xs text-[var(--muted)]">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------- headings */

export function SectionHeading({
  eyebrow,
  title,
  note,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="space-y-1">
        {eyebrow !== undefined && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {note !== undefined && <p className="text-sm text-[var(--ink-2)]">{note}</p>}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
