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

import type { ReactNode } from "react";

import { percent, signed } from "@/lib/format";

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

export function Sparkline({
  values,
  width = 76,
  height = 24,
  className = "",
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const path = sparkPath(values, width, height);
  if (path === "") return null;

  const first = values.find((value) => Number.isFinite(value)) ?? 0;
  const last = [...values].reverse().find((value) => Number.isFinite(value)) ?? 0;
  // Coloured by where this line went, not by the day's change: a seven-day sparkline that
  // fell is drawn falling even on a day the scrip rose.
  const stroke = last > first ? "var(--up)" : last < first ? "var(--down)" : "var(--flat)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      className={className}
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
    </svg>
  );
}

/* ---------------------------------------------------------------------------- chips */

/** A signed change in a tinted chip. The sign is always drawn, never colour alone. */
export function Chip({
  change,
  showPercent = true,
  size = "md",
  className = "",
}: {
  change: number | null;
  showPercent?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const tone = change === null || change === 0 ? "var(--flat)" : change > 0 ? "var(--up)" : "var(--down)";
  const text = showPercent ? percent(change) : signed(change);

  return (
    <span
      className={`tabular inline-flex items-center justify-end rounded-md font-medium ${
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
      } ${className}`}
      style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone }}
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

export function StatTile({
  icon,
  label,
  value,
  note,
  className = "",
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4 ${className}`}
    >
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="tabular text-xl font-semibold tracking-tight">{value}</p>
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
