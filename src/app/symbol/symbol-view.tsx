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
 *
 * ## The rail ranks by turnover, because the archive has no sectors
 *
 * A "related scrips" rail would normally group by industry or index membership. The
 * archive holds neither, and no share counts either, so any such grouping would be
 * invented. Turnover is a real column, so the rail takes the same session's other scrips
 * by it and says so, rather than inventing a peer set the data cannot support.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Change, ScripList } from "@/components/cards";
import { Activity, Layers, TrendDown, TrendUp } from "@/components/icons";
import { PriceChart, PriceTable, SeriesChange } from "@/components/price-chart";
import { Avatar, Chip, Segmented, SectionHeading, StatTile } from "@/components/ui";
import { changeColor, count, price, sessionDate, signed, turnover, volume } from "@/lib/format";
import { loadMarket, toSeries } from "@/lib/market";
import { RANGES, nepse, rangeStart, type RangeKey } from "@/lib/nepse";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/** `Segmented` wants `value`/`label`; `RANGES` names the query key `key`. Mapped once, here. */
const RANGE_OPTIONS: { value: RangeKey; label: string }[] = RANGES.map((range) => ({
  value: range.key,
  label: range.label,
}));

export function SymbolView() {
  const params = useSearchParams();
  const symbol = (params.get("t") ?? "").trim().toUpperCase();
  const [rangeKey, setRangeKey] = useState<RangeKey>("1m");

  const quote = useQuery({
    queryKey: ["quote", symbol],
    enabled: symbol !== "",
    queryFn: () => nepse().quote(symbol),
  });

  // The rail's fuel, and the homepage's query already: the same session file keyed the
  // same way, so arriving from the market costs no extra request.
  const market = useQuery({
    queryKey: ["market"],
    enabled: symbol !== "",
    queryFn: () => loadMarket(nepse()),
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
      <div className="space-y-12" aria-busy="true" aria-live="polite">
        <div className="space-y-6">
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--grid)]" />
          <div className="h-36 animate-pulse rounded-2xl bg-[var(--grid)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <div key={tile} className="h-24 animate-pulse rounded-xl bg-[var(--grid)]" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-[var(--grid)]" />
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

  const others =
    market.data === undefined
      ? []
      : [...market.data.rows]
          .filter((row) => row.symbol !== entry.symbol)
          .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
          .slice(0, 5);

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <nav className="text-xs text-[var(--muted)]">
          <Link href="/" className="hover:underline">
            Market
          </Link>
          <span className="mx-1.5">/</span>
          <span>{entry.symbol}</span>
        </nav>

        <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6">
          <h1 className="flex items-center gap-3">
            <Avatar symbol={entry.symbol} size={44} />
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="font-mono text-base font-semibold">{entry.symbol}</span>
              {name.data != null && (
                <span className="text-sm font-normal text-[var(--ink-2)]">{name.data}</span>
              )}
            </span>
          </h1>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="tabular text-4xl font-semibold tracking-tight">
              {price(entry.quote.close)}
            </p>
            <span className={`tabular text-sm font-medium ${changeColor(entry.change)}`}>
              {signed(entry.change)}
            </span>
            <Chip changePercent={entry.changePercent} />
          </div>

          <p className="mt-2 text-xs text-[var(--muted)]">
            End of day · {sessionDate(entry.date)} · previous close {price(entry.previousClose)}
          </p>
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Activity size={14} />} label="Open" value={price(entry.quote.open)} />
        <StatTile icon={<TrendUp size={14} />} label="High" value={price(entry.quote.high)} />
        <StatTile icon={<TrendDown size={14} />} label="Low" value={price(entry.quote.low)} />
        <StatTile
          icon={<Layers size={14} />}
          label="Volume"
          value={volume(entry.quote.volume)}
          note={`${turnover(entry.quote.turnover)} turnover`}
        />
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Session history"
          title="Closing price"
          note={
            points.length >= 2 ? (
              <>
                <SeriesChange points={points} /> over {count(points.length)} sessions from{" "}
                {sessionDate(points[0]!.date)}
              </>
            ) : (
              "Not enough sessions in this range."
            )
          }
          actions={
            <Segmented
              ariaLabel="Chart range"
              options={RANGE_OPTIONS}
              value={rangeKey}
              onChange={setRangeKey}
            />
          }
        />

        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          {history.isPending ? (
            <div className="h-80 animate-pulse rounded-lg bg-[var(--grid)]" />
          ) : history.error ? (
            <p className="py-8 text-center text-sm text-[var(--ink-2)]">{history.error.message}</p>
          ) : (
            <>
              <PriceChart points={points} />
              <PriceTable points={points} />
              <p className="mt-3 text-xs text-[var(--muted)]">
                The band behind the line is each session&apos;s high–low range. Prices are
                not adjusted for bonus shares, rights or splits.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Same session"
          title="Most traded scrips"
          note={`The five busiest by turnover on ${sessionDate(entry.date)}, ${entry.symbol} aside.`}
        />

        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          {market.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="h-10 animate-pulse rounded-lg bg-[var(--grid)]" />
              ))}
            </div>
          ) : market.error ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              The session could not be read.
            </p>
          ) : (
            <ScripList
              rows={others}
              figure={(row) => <Change row={row} />}
              empty={`No other scrip traded on ${sessionDate(entry.date)}.`}
            />
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
