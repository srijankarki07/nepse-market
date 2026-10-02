"use client";

/**
 * The landing page: what the package does, what it produces, and what is in the archive.
 *
 * ## Two speeds, deliberately
 *
 * The hero, the movers and the summary arrive together in four requests: the index, two
 * sessions, and the ticker directory. The index chart is a different animal, needing a
 * session file per day, so it loads separately behind its own placeholder. The page is
 * useful immediately and gets richer, rather than showing one spinner over everything
 * while the most expensive piece catches up.
 *
 * ## The date on screen is the archive's, never the clock
 *
 * A reader who sees "today" assumes the prices are today's. On a holiday, or before the
 * daily job has run, they are not, and the archive is the only thing that knows which
 * session it holds.
 *
 * ## Layout notes
 *
 * `items-start` so a card is only as tall as its content. Left to stretch, a grid row
 * makes every card the height of the tallest in it, and the short ones get a bordered
 * field of empty space that reads as content which failed to load.
 *
 * The row is a four-column grid down to `lg` and two columns below it, because four
 * equal cards stop being readable well before a phone. Cards that hold a list of five
 * scrips are deliberately grouped, since they are the same height as each other and
 * nothing else is.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Breadth, Card, Change, CoverageColumns, ScripList } from "@/components/cards";
import { Hero } from "@/components/hero";
import { IndexChart, IndexTable } from "@/components/index-chart";
import { MarketTable } from "@/components/market-table";
import { count, sessionDate, turnover, volume } from "@/lib/format";
import { computeMarketIndex } from "@/lib/index-series";
import { loadMarket, summarise } from "@/lib/market";
import { nepse, rangeStart } from "@/lib/nepse";

/** The index ranges. Short by default: a year is 230 session files. */
const INDEX_RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
] as const;

export default function Home() {
  const [indexDays, setIndexDays] = useState<number>(90);

  const market = useQuery({ queryKey: ["market"], queryFn: () => loadMarket(nepse()) });

  const index = useQuery({
    queryKey: ["index", indexDays, market.data?.date],
    enabled: market.data !== undefined,
    queryFn: async () => {
      const to = market.data?.date;
      if (to === undefined) throw new Error("No session to measure from.");

      const sessions = await nepse().sessions({ from: rangeStart(to, indexDays), to });
      return computeMarketIndex(sessions);
    },
  });

  if (market.isPending) return <Loading />;

  if (market.error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-[var(--down)] bg-[var(--surface)] p-5 text-sm"
      >
        <p className="font-medium">The archive could not be read.</p>
        <p className="mt-1 text-[var(--ink-2)]">{market.error.message}</p>
      </div>
    );
  }

  const data = market.data;
  const summary = summarise(data.rows);

  const ranked = {
    gainers: [...data.rows]
      .filter((row) => row.change !== null)
      .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
      .slice(0, 5),
    losers: [...data.rows]
      .filter((row) => row.change !== null)
      .sort((a, b) => (a.change ?? 0) - (b.change ?? 0))
      .slice(0, 5),
    byTurnover: [...data.rows].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 5),
    byVolume: [...data.rows].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5),
  };

  const indexChange = index.data?.changePercent ?? null;
  const indexUp = indexChange !== null && indexChange > 0;

  return (
    <div className="space-y-12">
      <Hero market={data} />

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Equal-weighted index</h2>
            <p className="text-sm text-[var(--ink-2)]">
              {index.isPending ? (
                "Reading sessions"
              ) : indexChange === null ? (
                "Not enough sessions in this range."
              ) : (
                <>
                  <span
                    className={`font-medium ${indexUp ? "text-[var(--up)]" : "text-[var(--down)]"}`}
                  >
                    {indexUp ? "+" : "-"}
                    {Math.abs(indexChange).toFixed(2)}%
                  </span>{" "}
                  over {index.data?.points.length ?? 0} sessions from{" "}
                  {sessionDate(index.data?.points[0]?.date ?? data.date)}
                </>
              )}
            </p>
          </div>

          {/* One control row above what it scopes, not a filter inside the card. */}
          <div className="flex gap-1" role="group" aria-label="Index range">
            {INDEX_RANGES.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setIndexDays(option.days)}
                aria-pressed={option.days === indexDays}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  option.days === indexDays
                    ? "bg-[var(--ink)] text-[var(--plane)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--grid)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
          {index.isPending ? (
            <div className="h-72 animate-pulse rounded-lg bg-[var(--grid)]" />
          ) : index.error ? (
            <p className="py-8 text-center text-sm text-[var(--ink-2)]">{index.error.message}</p>
          ) : (
            <>
              <IndexChart index={index.data} />
              <IndexTable index={index.data} />
            </>
          )}

          <p className="mt-3 text-xs text-[var(--muted)]">
            A derived index, not NEPSE&rsquo;s: the average of every scrip&rsquo;s daily
            change, chained from 100. The archive holds prices, not market capitalisation,
            so a capitalisation-weighted index cannot be reproduced from it.
          </p>
        </div>
      </section>

      {/* Movers first, grouped because they are the same shape and so the same height. */}
      <section className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Top gainers" note="by change" accent="up">
          <ScripList rows={ranked.gainers} figure={(row) => <Change row={row} />} />
        </Card>

        <Card title="Top losers" note="by change" accent="down">
          <ScripList rows={ranked.losers} figure={(row) => <Change row={row} />} />
        </Card>

        <Card title="Most traded" note="by turnover" accent="market">
          <ScripList rows={ranked.byTurnover} figure={(row) => turnover(row.turnover)} />
        </Card>

        <Card title="Busiest by volume" note="shares" accent="market">
          <ScripList rows={ranked.byVolume} figure={(row) => volume(row.volume)} />
        </Card>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-3">
        <Card title="Breadth" note={sessionDate(data.date)} accent="market">
          <Breadth
            advancing={summary.advancing}
            declining={summary.declining}
            unchanged={summary.unchanged}
            unknown={summary.unknown}
          />
        </Card>

        <Card title="The day" note={sessionDate(data.date)} accent="neutral">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Figure label="Scrips traded" value={count(summary.scrips)} />
            <Figure label="Turnover" value={turnover(summary.turnover)} />
            <Figure label="Shares traded" value={volume(summary.volume)} />
            <Figure
              label="Compared with"
              value={data.previousDate === null ? "Nothing" : sessionDate(data.previousDate)}
            />
          </dl>
        </Card>

        <Card
          title="Archive coverage"
          note={`${count(data.sessionsInArchive)} sessions since 2011`}
          accent="archive"
        >
          <CoverageColumns years={data.years} />
        </Card>
      </section>

      <section id="market" className="space-y-5 scroll-mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Every listed security</h2>
          <p className="text-sm text-[var(--ink-2)]">
            {sessionDate(data.date)}.{" "}
            <Link href="/about/" className="underline">
              About this data
            </Link>
          </p>
        </div>
        <MarketTable rows={data.rows} />
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-12" aria-busy="true" aria-live="polite">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-12 w-3/4 animate-pulse rounded bg-[var(--grid)]" />
          <div className="h-24 animate-pulse rounded bg-[var(--grid)]" />
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-[var(--grid)]" />
      </div>
      <p className="text-sm text-[var(--ink-2)]">Reading the archive</p>
    </div>
  );
}
