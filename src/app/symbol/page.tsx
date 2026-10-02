"use client";

/**
 * One scrip: its latest price, a chart, and its recent sessions.
 *
 * ## Why the ticker is a query parameter and not a path segment
 *
 * `/symbol/NABIL` is the nicer URL and it is the obvious choice — right up until the site
 * is statically exported, at which point a dynamic segment has to be enumerated at build
 * time. That would mean the build fetching the ticker list, so the build depends on the
 * archive being reachable, and a company listed this morning 404s until the next deploy.
 *
 * `?t=NABIL` sidesteps all of it: one page, no build-time network, and a newly listed
 * scrip works the moment the archive publishes it. The URL is marginally less pretty and
 * the failure mode is gone.
 *
 * ## The range is the reader's choice, because the cost is theirs
 *
 * A year is 230 session files. Cached they are free, but the first load of a long range
 * on a cold cache is seconds of fetching, so the default is deliberately short and the
 * longer ranges are a deliberate click rather than something every visitor pays for.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PriceChart } from "@/components/price-chart";
import { changeColor, count, percent, price, sessionDate, signed, turnover, volume } from "@/lib/format";
import { toSeries } from "@/lib/market";
import { RANGES, nepse, rangeStart, type RangeKey } from "@/lib/nepse";

export default function SymbolPage() {
  // `useSearchParams` needs a boundary to prerender, which a static export does at build.
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <SymbolView />
    </Suspense>
  );
}

function SymbolView() {
  const params = useSearchParams();
  const symbol = (params.get("t") ?? "").trim().toUpperCase();
  const [rangeKey, setRangeKey] = useState<RangeKey>("3m");

  const quote = useQuery({
    queryKey: ["quote", symbol],
    enabled: symbol !== "",
    queryFn: () => nepse().quote(symbol),
  });

  // Separate from the quote because it comes from a different file and is a nicety: a
  // scrip whose name the archive has never recorded still prices perfectly well.
  const name = useQuery({
    queryKey: ["name", symbol],
    enabled: symbol !== "",
    queryFn: () => nepse().name(symbol),
  });

  const range = RANGES.find((entry) => entry.key === rangeKey) ?? RANGES[1];

  const history = useQuery({
    queryKey: ["history", symbol, rangeKey, quote.data?.date],
    enabled: symbol !== "" && quote.data !== undefined,
    queryFn: async () => {
      const to = quote.data?.date;
      if (to === undefined) throw new Error("No session to measure from.");

      return nepse().history(symbol, { from: rangeStart(to, range.days), to });
    },
  });

  if (symbol === "") {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        No scrip named. <Link href="/" className="underline">Back to the market</Link>.
      </p>
    );
  }

  if (quote.isPending) return <p className="text-sm text-neutral-500">Reading {symbol}…</p>;

  if (quote.error) {
    return (
      <div className="space-y-3">
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">{symbol} could not be priced.</p>
          <p className="mt-1 opacity-90">{quote.error.message}</p>
        </div>
        <Link href="/" className="text-sm underline">
          Back to the market
        </Link>
      </div>
    );
  }

  const entry = quote.data;
  const points = toSeries(history.data ?? []);

  return (
    <div className="space-y-6">
      <nav className="text-xs text-neutral-500 dark:text-neutral-400">
        <Link href="/" className="hover:underline">
          Market
        </Link>
        <span className="mx-1.5">/</span>
        <span>{entry.symbol}</span>
      </nav>

      <section className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{entry.symbol}</h1>
          <p className={`text-lg font-medium tabular-nums ${changeColor(entry.change)}`}>
            {price(entry.quote.close)}
            <span className="ml-2 text-sm">
              {signed(entry.change)} ({percent(entry.changePercent)})
            </span>
          </p>
        </div>
        {name.data != null && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{name.data}</p>
        )}
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {sessionDate(entry.date)}
          {entry.previousClose !== null && <> · against {price(entry.previousClose)}</>}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open" value={price(entry.quote.open)} />
        <Stat label="High" value={price(entry.quote.high)} />
        <Stat label="Low" value={price(entry.quote.low)} />
        <Stat label="Volume" value={volume(entry.quote.volume)} detail={turnover(entry.quote.turnover) + " turnover"} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Closing price</h2>
          <div className="flex gap-1" role="group" aria-label="Chart range">
            {RANGES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRangeKey(option.key)}
                aria-pressed={option.key === rangeKey}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  option.key === rangeKey
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {history.isPending ? (
          <div className="h-80 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        ) : history.error ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {history.error.message}
          </p>
        ) : (
          <>
            <PriceChart points={points} />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {count(points.length)} sessions{points.length > 0 && <> · {sessionDate(points[0]!.date)} to {sessionDate(points.at(-1)!.date)}</>}
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {detail !== undefined && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{detail}</p>
      )}
    </div>
  );
}
