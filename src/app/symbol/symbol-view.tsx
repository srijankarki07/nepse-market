"use client";

/**
 * One scrip: its latest price, a chart, and its recent sessions.
 *
 * ## Why the ticker is a query parameter and not a path segment
 *
 * `/symbol/NABIL` is the nicer URL and it is the obvious choice, right up until the site
 * is statically exported, at which point a dynamic segment has to be enumerated at build
 * time. That would mean the build fetching the ticker list, so the build depends on the
 * archive being reachable, and a company listed this morning 404s until the next deploy.
 *
 * `?t=NABIL` sidesteps all of it: one page, no build-time network, and a newly listed
 * scrip works the moment the archive publishes it.
 *
 * The cost is paid in search: all 353 scrips are served by one HTML file, so the server
 * cannot write a per-scrip title. `page.tsx` therefore ships a generic title, and
 * `useScripMetadata` below rewrites the title, description and canonical on the client
 * once the symbol is known. A crawler that runs JavaScript, which the ones that matter do,
 * sees the same tags a static page would have had.
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
import { useEffect, useState } from "react";

import { Card } from "@/components/cards";
import { PriceChart, PriceTable, SeriesChange } from "@/components/price-chart";
import { changeColor, count, percent, price, sessionDate, signed, turnover, volume } from "@/lib/format";
import { toSeries } from "@/lib/market";
import { RANGES, nepse, rangeStart, type RangeKey } from "@/lib/nepse";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function SymbolView() {
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

  useScripMetadata(symbol, name.data ?? null);

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
      <p className="text-sm text-[var(--ink-2)]">
        No scrip named.{" "}
        <Link href="/" className="underline">
          Back to the market
        </Link>
        .
      </p>
    );
  }

  if (quote.isPending) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--grid)]" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--grid)]" />
        <div className="h-80 animate-pulse rounded-xl bg-[var(--grid)]" />
        <p className="text-sm text-[var(--ink-2)]">Reading {symbol}…</p>
      </div>
    );
  }

  if (quote.error) {
    return (
      <div className="space-y-3">
        <div
          role="alert"
          className="rounded-lg border border-[var(--down)] bg-[var(--surface)] p-4 text-sm"
        >
          <p className="font-medium">{symbol} could not be priced.</p>
          <p className="mt-1 text-[var(--ink-2)]">{quote.error.message}</p>
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
      <nav className="text-xs text-[var(--muted)]">
        <Link href="/" className="hover:underline">
          Market
        </Link>
        <span className="mx-1.5">/</span>
        <span>{entry.symbol}</span>
      </nav>

      <section className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{entry.symbol}</h1>
          <p className={`text-xl font-semibold ${changeColor(entry.change)}`}>
            {price(entry.quote.close)}
            <span className="ml-2 text-sm font-medium">
              {signed(entry.change)} ({percent(entry.changePercent)})
            </span>
          </p>
        </div>
        {name.data != null && <p className="text-sm text-[var(--ink-2)]">{name.data}</p>}
        <p className="text-xs text-[var(--muted)]">
          {sessionDate(entry.date)}
          {entry.previousClose !== null && <> · against {price(entry.previousClose)}</>}
        </p>
      </section>

      <section className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Open">
          <p className="tabular text-2xl font-semibold">{price(entry.quote.open)}</p>
        </Card>
        <Card title="High">
          <p className="tabular text-2xl font-semibold">{price(entry.quote.high)}</p>
        </Card>
        <Card title="Low">
          <p className="tabular text-2xl font-semibold">{price(entry.quote.low)}</p>
        </Card>
        <Card title="Volume" note={turnover(entry.quote.turnover) + " turnover"}>
          <p className="tabular text-2xl font-semibold">{volume(entry.quote.volume)}</p>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Closing price</h2>
            {points.length >= 2 && (
              <p className="text-sm text-[var(--ink-2)]">
                <SeriesChange points={points} />{" "}
                <span className="text-[var(--muted)]">
                  over {count(points.length)} sessions from {sessionDate(points[0]!.date)}
                </span>
              </p>
            )}
          </div>

          {/* One control row above what it scopes, never a filter inside the card. */}
          <div className="flex gap-1" role="group" aria-label="Chart range">
            {RANGES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRangeKey(option.key)}
                aria-pressed={option.key === rangeKey}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  option.key === rangeKey
                    ? "bg-[var(--ink)] text-[var(--plane)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--grid)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
          {history.isPending ? (
            <div className="h-80 animate-pulse rounded-lg bg-[var(--grid)]" />
          ) : history.error ? (
            <p className="py-8 text-center text-sm text-[var(--ink-2)]">{history.error.message}</p>
          ) : (
            <>
              <PriceChart points={points} />
              <PriceTable points={points} />
              <p className="mt-2 text-xs text-[var(--muted)]">
                The band behind the line is each session&apos;s high–low range. Prices are
                not adjusted for bonus shares, rights or splits.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Writes the per-scrip tags that a static export cannot write at build time.
 *
 * All 353 scrips are one HTML file, so `page.tsx` can only ship a generic title. This
 * rewrites the three tags a search result is built from once the scrip is known, and puts
 * them back on the way out so navigating to the market does not leave NABIL in the tab.
 *
 * The title carries no price on purpose. This runs in the browser and a crawler indexes a
 * snapshot: a price in the title would be wrong within a session and would keep being
 * served from the index long after.
 *
 * The canonical is set here and not in `page.tsx` for the same reason the title is: the
 * scrip is not known on the server. It is what keeps `?t=NABIL` and `?t=NABIL&x=1` from
 * competing as two pages, while leaving every scrip its own canonical rather than
 * collapsing all 353 onto `/symbol/`.
 */
function useScripMetadata(symbol: string, name: string | null) {
  useEffect(() => {
    if (symbol === "") return;

    const title = `${symbol}${name === null ? "" : ` · ${name}`} share price history | ${SITE_NAME}`;
    const description = `${symbol} closing price, day change and session history on the Nepal Stock Exchange, from the end-of-day archive. Not a live quote.`;

    const previousTitle = document.title;
    document.title = title;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content ?? null;
    if (meta !== null) meta.content = description;

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const previousOgTitle = ogTitle?.content ?? null;
    if (ogTitle !== null) ogTitle.content = title;

    // One per document, so it is removed rather than left to accumulate as the reader
    // moves between scrips.
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = `${SITE_URL}/symbol/?t=${encodeURIComponent(symbol)}`;
    document.head.append(canonical);

    return () => {
      document.title = previousTitle;
      if (meta !== null && previousDescription !== null) meta.content = previousDescription;
      if (ogTitle !== null && previousOgTitle !== null) ogTitle.content = previousOgTitle;
      canonical.remove();
    };
  }, [symbol, name]);
}
