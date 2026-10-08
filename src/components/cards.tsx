"use client";

/**
 * The pieces the bento grid is built from.
 *
 * Each card answers one question about the market. Anything needing two answers is two
 * cards, because a card that answers two questions is read as answering neither.
 *
 * ## Colour carries grouping, not decoration
 *
 * Most cards are monochrome on purpose: the figures are the point and a rainbow of
 * accents would compete with them. Where colour does appear it says something:
 * `accent` tints a card's rule by *what family of question it answers*, so the eye can
 * sort the grid into market-wide, movers, and archive without reading a word. It is
 * consistent within a family and never encodes a value, which is the line between a
 * grouping cue and a chart that has lost its mind.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar, Chip } from "@/components/ui";
import { count, percent } from "@/lib/format";
import type { MarketRow } from "@/lib/market";

/** Which family of question a card answers. Drives the accent, nothing else. */
export type Accent = "market" | "up" | "down" | "archive" | "neutral";

const ACCENT: Record<Accent, string> = {
  market: "var(--seq-5)",
  up: "var(--up)",
  down: "var(--down)",
  archive: "var(--seq-3)",
  neutral: "var(--muted)",
};

export function Card({
  title,
  note,
  accent = "neutral",
  className = "",
  children,
}: {
  title: string;
  note?: string;
  accent?: Accent;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5 ${className}`}
    >
      <header className="flex items-baseline gap-2.5">
        {/* A short coloured rule beside the title, rather than an edge across the whole
            card. A top border turns every card into a tab and makes the grid read as a
            set of stripes; a mark this size groups the card without shouting. */}
        <span
          aria-hidden
          className="h-3.5 w-1 shrink-0 self-center rounded-full"
          style={{ background: ACCENT[accent] }}
        />
        <h2 className="text-sm font-medium">{title}</h2>
        {note !== undefined && (
          <span className="ml-auto text-xs text-[var(--muted)]">{note}</span>
        )}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** A list of scrips with one figure each. Rows link, because that is what a reader does. */
export function ScripList({
  rows,
  figure,
  empty = "Nothing to show.",
}: {
  rows: readonly MarketRow[];
  figure: (row: MarketRow) => ReactNode;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--muted)]">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-[var(--hairline)]">
      {rows.map((row) => (
        <li
          key={row.symbol}
          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          {/* The mark is what makes a list of tickers scannable, which is why every
              reference puts one in the first column. */}
          <Avatar symbol={row.symbol} size={30} />
          <Link
            href={`/symbol/?t=${encodeURIComponent(row.symbol)}`}
            className="min-w-0 flex-1 hover:underline"
          >
            <span className="font-mono text-sm font-semibold">{row.symbol}</span>
            {row.name !== null && (
              <span className="block truncate text-xs text-[var(--muted)]">{row.name}</span>
            )}
          </Link>
          <span className="tabular shrink-0 text-right text-sm">{figure(row)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The day change, as a chip.
 *
 * A chip rather than bare coloured text because it gives the figure a fixed place to sit in
 * a column, which is what the references rely on to make a table of changes readable.
 */
export function Change({ row }: { row: MarketRow }) {
  return <Chip changePercent={row.changePercent} />;
}

/**
 * Advancing, declining and unchanged, as a split bar over three labelled figures.
 *
 * The three counts are the card's real content, the bar is what makes the *shape* of
 * the day legible at a glance, and the numbers are what make it readable without relying
 * on it. Colour never carries the meaning alone: each figure is labelled.
 */
export function Breadth({
  advancing,
  declining,
  unchanged,
  unknown,
}: {
  advancing: number;
  declining: number;
  unchanged: number;
  unknown: number;
}) {
  const moved = advancing + declining;
  const total = moved + unchanged;

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-[var(--muted)]">No scrips moved.</p>;
  }

  const advancingPercent = total === 0 ? 0 : (advancing / total) * 100;
  const decliningPercent = total === 0 ? 0 : (declining / total) * 100;
  const breadth = moved === 0 ? null : (advancing / moved) * 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Advancing" value={advancing} tone="up" />
        <Figure label="Declining" value={declining} tone="down" />
        <Figure label="Unchanged" value={unchanged} tone="flat" />
      </div>

      <div className="flex h-3.5 overflow-hidden rounded-full bg-[var(--grid)]">
        <div className="bg-[var(--up)]" style={{ width: `${advancingPercent}%` }} />
        {/* The gap is the surface showing through, never a border. */}
        <div className="w-0.5 bg-[var(--surface)]" />
        <div className="bg-[var(--down)]" style={{ width: `${decliningPercent}%` }} />
      </div>

      {breadth !== null && (
        <p className="text-xs text-[var(--ink-2)]">
          <span className="font-medium text-[var(--ink)]">{percent(breadth - 50)}</span> breadth
          across the {count(moved)} scrips that moved
        </p>
      )}

      {unknown > 0 && (
        <p className="text-xs text-[var(--muted)]">
          {count(unknown)} show no change: they did not trade in the previous session, or it
          predates them.
        </p>
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone: "up" | "down" | "flat" }) {
  const colour = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--flat)";

  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-semibold" style={{ color: colour }}>
        {count(value)}
      </p>
    </div>
  );
}

/**
 * Archive coverage, as columns by year.
 *
 * Sixteen rows of horizontal bars was a list pretending to be a chart: too tall, too much
 * text, and the two years that matter, 2015 and 2020, buried among fourteen that do not.
 * Columns put the shape in one glance and leave room to mark the two dips, which are the
 * only thing about this data anybody needs to be told.
 *
 * The colour is the sequential blue ramp, keyed to completeness rather than to the value
 * the column already shows: a column at its full year's worth of sessions is solid, the
 * current part-year is pale. That is a real distinction, "the year is not over", and not
 * a restatement of the height.
 */
export function CoverageColumns({ years }: { years: Record<string, number> }) {
  const entries = Object.entries(years).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;

  const max = Math.max(...entries.map(([, n]) => n));

  // A full year in this archive runs a little over 240 sessions. Anything well short of
  // that is either a part-year or one of the two closures, and both read pale.
  const fullYear = max;

  const notable = new Map<string, string>([
    ["2015", "the earthquake"],
    ["2020", "the COVID halt"],
  ]);

  return (
    <div className="space-y-3">
      <div className="flex h-32 items-end gap-1">
        {entries.map(([year, sessions]) => {
          const complete = sessions >= fullYear * 0.85;
          const note = notable.get(year);

          return (
            // `group` plus a positioned child gives the tooltip without any state, and
            // `tabIndex` on the column means the same information arrives on keyboard
            // focus rather than only on hover.
            //
            // The outline is no longer suppressed here. It was, on the grounds that the
            // tooltip said everything the ring would; the tooltip says what the column is
            // but not that the column is what has focus, and a keyboard user tabbing
            // through the chart needs the second. The global `:focus-visible` rule draws it
            // and the tooltip still opens beside it.
            <div
              key={year}
              className="group relative flex h-full flex-1 flex-col justify-end rounded-sm"
              tabIndex={0}
              aria-label={`${year}: ${sessions} sessions${note === undefined ? "" : `, shortened by ${note}`}`}
            >
              <div
                className="w-full rounded-t-sm transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                style={{
                  height: `${(sessions / max) * 100}%`,
                  background: complete ? "var(--seq-5)" : "var(--seq-2)",
                }}
              />

              {/* Hidden until hovered or focused, so it never occludes a neighbouring
                  column, and `pointer-events-none` so it cannot swallow the hover. */}
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md group-hover:block group-focus-visible:block"
              >
                <span className="font-medium">{year}</span>
                <span className="tabular text-[var(--ink-2)]">
                  {sessions} session{sessions === 1 ? "" : "s"}
                </span>
                {note !== undefined && (
                  <span className="block text-[var(--muted)]">short by {note}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* A year label every few columns, rather than sixteen overlapping ones. */}
      <div className="flex gap-1 text-[10px] text-[var(--muted)]">
        {entries.map(([year], index) => (
          <span key={year} className="flex-1 text-center">
            {index % 3 === 0 || index === entries.length - 1 ? year.slice(2) : ""}
          </span>
        ))}
      </div>

      <p className="text-xs text-[var(--ink-2)]">
        2015 is short by the earthquake and 2020 by the COVID halt. The pale column is the
        year still in progress.
      </p>

      {/* The table twin. The tooltip enhances the chart; this is what makes the values
          reachable without a pointer, a hover, or the ability to separate the two blues. */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--ink-2)]">
          Sessions by year
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-x-4">
          {entries.map(([year, sessions]) => (
            <div
              key={year}
              className="flex items-baseline justify-between gap-2 border-b border-[var(--hairline)] py-1"
            >
              <span className="text-[var(--ink-2)]">{year}</span>
              <span className="tabular">{sessions}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
