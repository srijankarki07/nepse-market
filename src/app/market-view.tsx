"use client";

/**
 * The landing page's interactive body.
 *
 * ## Why this is a separate file from `page.tsx`
 *
 * `metadata` and `generateMetadata` are server-only exports, and this is a client
 * component. Splitting the two is what lets the page carry its own canonical URL and open
 * graph tags while still holding the queries and the range buttons. The server half is
 * `page.tsx`; nothing here knows or cares about metadata.
 *
 * ## Three requests, then a fourth that can take its time
 *
 * The hero, the pulse, the movers and the table arrive together: the index, two sessions and
 * the ticker directory. The index chart is a different animal, one file per calendar year
 * rather than one per session, so it loads behind its own placeholder and the page is
 * useful immediately rather than showing one spinner over everything.
 *
 * ## The date on screen is the archive's, never the clock
 *
 * A reader who sees "today" assumes the prices are today's. On a holiday, or before the
 * daily job has run, they are not, and the archive is the only thing that knows which
 * session it holds.
 *
 * ## What is not here, and why
 *
 * The references show a "total transactions" tile and a volume histogram under the index
 * chart. The archive has neither: its columns are prices and shares, with no trade count,
 * and the closes index behind the chart carries no volume. Both would have to be invented,
 * so neither is shown.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Breadth, Card, Change, CoverageColumns, ScripList } from "@/components/cards";
import { Hero } from "@/components/hero";
import { Activity, Banknote, Grid, Layers } from "@/components/icons";
import { IndexChart, IndexTable } from "@/components/index-chart";
import { MarketTable } from "@/components/market-table";
import { Segmented, SectionHeading, StatTile } from "@/components/ui";
import { count, sessionDate, turnover, volume } from "@/lib/format";
import { computeMarketIndex } from "@/lib/index-series";
import { loadMarket, summarise } from "@/lib/market";
import { nepse, rangeStart } from "@/lib/nepse";

/** The index ranges. A year is two closes files, so even the longest is a cheap read. */
const INDEX_RANGES = [
  { value: 30, label: "1M" },
  { value: 90, label: "3M" },
  { value: 180, label: "6M" },
  { value: 365, label: "1Y" },
] as const;

/** The trend column: a week of closes per ticker, from one request for the whole market. */
const TREND_DAYS = 7;

export function MarketView() {
  const [indexDays, setIndexDays] = useState<number>(90);

  const market = useQuery({ queryKey: ["market"], queryFn: () => loadMarket(nepse()) });

  const index = useQuery({
    queryKey: ["index", indexDays, market.data?.date],
    enabled: market.data !== undefined,
    queryFn: async () => {
      const to = market.data?.date;
      if (to === undefined) throw new Error("No session to measure from.");

      // One request per calendar year, rather than one per trading day: the closes index is
      // wide, so a year of the whole market is a single file.
      const days = await nepse().closes({ from: rangeStart(to, indexDays), to });
      return computeMarketIndex(days);
    },
  });

  const trends = useQuery({
    queryKey: ["trends", TREND_DAYS, market.data?.date],
    enabled: market.data !== undefined,
    queryFn: async () => {
      const to = market.data?.date;
      if (to === undefined) throw new Error("No session to measure from.");

      const days = await nepse().closes({ from: rangeStart(to, TREND_DAYS), to });
      const series = new Map<string, number[]>();
      for (const day of days) {
        for (const [symbol, close] of day.closes) {
          const points = series.get(symbol);
          if (points === undefined) series.set(symbol, [close]);
          else points.push(close);
        }
      }
      return series;
    },
  });

  if (market.isPending) return <Loading />;

  if (market.error) {
    return (
      <div role="alert" className="rounded-lg border border-[var(--down)] bg-[var(--surface)] p-5 text-sm">
        <p className="font-medium">The archive could not be read.</p>
        <p className="mt-1 text-[var(--ink-2)]">{market.error.message}</p>
      </div>
    );
  }

  const data = market.data;
  const summary = summarise(data.rows);

  const ranked = {
    // Ranked by percentage, not by the cash move: a 49,000-rupee scrip drifting 2% moves
    // more rupees than a 100-rupee one falling 5%, and ranking by that puts the expensive
    // scrips at the top of a list the reader is using to find today's biggest movers.
    gainers: [...data.rows]
      .filter((row) => row.changePercent !== null)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
      .slice(0, 5),
    losers: [...data.rows]
      .filter((row) => row.changePercent !== null)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
      .slice(0, 5),
    byTurnover: [...data.rows].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 5),
    byVolume: [...data.rows].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5),
  };

  const indexChange = index.data?.changePercent ?? null;
  const points = index.data?.points ?? [];
  const firstDate = points[0]?.date ?? data.date;

  return (
    <div className="space-y-12">
      <Hero market={data} />

      {/* The market pulse. One heading, one control row above what it scopes, one panel. */}
      <section className="space-y-5">
        <SectionHeading
          eyebrow="Market pulse"
          title="Equal-weighted market index"
          note={
            index.isPending ? (
              "Reading sessions"
            ) : indexChange === null ? (
              "Not enough sessions in this range."
            ) : (
              <>
                <span className={`font-medium ${indexChange > 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                  {indexChange > 0 ? "+" : "−"}
                  {Math.abs(indexChange).toFixed(2)}%
                </span>{" "}
                over {count(points.length)} sessions, {sessionDate(firstDate)} to{" "}
                {sessionDate(data.date)}
              </>
            )
          }
          actions={
            <Segmented
              ariaLabel="Index range"
              options={INDEX_RANGES}
              value={indexDays}
              onChange={setIndexDays}
            />
          }
        />

        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
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
            A derived index, not NEPSE&rsquo;s: the average of every scrip&rsquo;s daily change,
            chained from 100, so it is the return of holding every listed scrip in equal amounts.
            NEPSE weights by market capitalisation and the archive holds no share counts, so its
            index cannot be reproduced from this data.
          </p>
        </div>

        {/* Breadth first, then the session's totals: the shape of the day before its size. */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Advanced" value={count(summary.advancing)} tone="up" />
          <StatTile label="Declined" value={count(summary.declining)} tone="down" />
          <StatTile label="Unchanged" value={count(summary.unchanged)} tone="flat" />
          <StatTile icon={<Grid size={14} />} label="Scrips traded" value={count(summary.scrips)} />
          <StatTile
            icon={<Banknote size={14} />}
            label="Turnover"
            value={turnover(summary.turnover)}
          />
          <StatTile
            icon={<Activity size={14} />}
            label="Shares traded"
            value={volume(summary.volume)}
          />
        </div>
      </section>

      {/* Movers first, grouped because they are the same shape and so the same height. */}
      <section className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Top gainers" note="by change %" accent="up">
          <ScripList rows={ranked.gainers} figure={(row) => <Change row={row} />} />
        </Card>

        <Card title="Top losers" note="by change %" accent="down">
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
            {[
              { label: "Scrips traded", value: count(summary.scrips) },
              { label: "Turnover", value: turnover(summary.turnover) },
              { label: "Shares traded", value: volume(summary.volume) },
              {
                label: "Compared with",
                value: data.previousDate === null ? "Nothing" : sessionDate(data.previousDate),
              },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-[var(--muted)]">{item.label}</dt>
                <dd className="tabular mt-0.5 text-lg font-semibold">{item.value}</dd>
              </div>
            ))}
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
        <SectionHeading
          title="Every listed security"
          note={
            <>
              {sessionDate(data.date)}.{" "}
              <Link href="/about/" className="underline">
                About this data
              </Link>
            </>
          }
          actions={
            <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] sm:flex">
              <Layers size={14} />
              one session, every scrip
            </span>
          }
        />
        <MarketTable rows={data.rows} trends={trends.data} />
      </section>
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
