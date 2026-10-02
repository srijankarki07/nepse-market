"use client";

/**
 * The pieces the bento grid is built from.
 *
 * Each is one question about the market with one answer, which is what a card in a grid
 * is for. Anything needing two answers is two cards.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { changeColor, count, percent, signed } from "@/lib/format";
import type { MarketRow } from "@/lib/market";

/** The shared card shell: a title, an optional note, and the content. */
export function Card({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4 ${className}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {note !== undefined && <span className="text-xs text-[var(--muted)]">{note}</span>}
      </header>
      {children}
    </section>
  );
}

/**
 * A list of scrips with one figure each.
 *
 * Rows are links, because the first thing a reader does with a name in a market list is
 * click it — and a card that shows a ticker it will not take you to is a dead end.
 */
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
        <li key={row.symbol} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <Link
            href={`/symbol/?t=${encodeURIComponent(row.symbol)}`}
            className="min-w-0 flex-1 hover:underline"
          >
            <span className="text-sm font-medium">{row.symbol}</span>
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

/** The day change, signed and coloured. The sign carries it; colour is the second channel. */
export function Change({ row }: { row: MarketRow }) {
  return (
    <span className={changeColor(row.change)}>
      {signed(row.change)}
      <span className="block text-xs opacity-80">{percent(row.changePercent)}</span>
    </span>
  );
}

/**
 * Advancing against declining, as a single split bar.
 *
 * A two-part bar rather than a pie: the question is "how lopsided", which a length
 * answers at a glance and an angle does not. The two segments are separated by a 2px gap
 * in the surface colour rather than by a stroke, and each side is labelled with its count
 * so the split is legible without relying on which colour is which.
 */
export function BreadthBar({ advancing, declining }: { advancing: number; declining: number }) {
  const total = advancing + declining;

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-[var(--muted)]">No scrips moved.</p>;
  }

  const advancingPercent = (advancing / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--grid)]">
        <div className="bg-[var(--up)]" style={{ width: `${advancingPercent}%` }} />
        {/* The gap is the surface showing through, not a border. */}
        <div className="w-0.5 bg-[var(--surface)]" />
        <div className="flex-1 bg-[var(--down)]" />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-[var(--ink-2)]">
          <span className="font-medium text-[var(--ink)]">{count(advancing)}</span> advancing
        </span>
        <span className="text-[var(--ink-2)]">
          <span className="font-medium text-[var(--ink)]">{count(declining)}</span> declining
        </span>
      </div>
    </div>
  );
}

/** Archive coverage: how many sessions each year holds. */
export function CoverageBars({ years }: { years: Record<string, number> }) {
  const entries = Object.entries(years).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, n]) => n), 1);

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {entries.map(([year, sessions]) => (
          <li key={year} className="flex items-center gap-2 text-xs">
            <span className="tabular w-10 shrink-0 text-[var(--muted)]">{year}</span>
            {/*
              A single hue, because this is magnitude — "how many" — not identity. A
              value-ramp here would double-encode the length the bar already shows.
            */}
            <span
              className="animate-wipe h-2 rounded-sm bg-[var(--seq-5)]"
              style={{ width: `${(sessions / max) * 100}%` }}
            />
            <span className="tabular shrink-0 text-[var(--muted)]">{sessions}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
