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
import { IndexGrid } from "@/components/index-grid";
import { Segmented, SectionHeading, Skeleton, StatTile, type TrendPoint } from "@/components/ui";
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

  /**
   * The exchange's own index levels.
   *
   * Absent on any archive that predates the artifact, where `indices()` answers an empty
   * array rather than throwing, so the grid hides itself and the computed index above is
   * the only one shown. That is the documented fallback, not a degraded state.
   */
  const levels = useQuery({
    queryKey: ["indices", market.data?.date],
    enabled: market.data !== undefined,
    queryFn: () => nepse().indices(),
  });

  const trends = useQuery({
    queryKey: ["trends", TREND_DAYS, market.data?.date],
    enabled: market.data !== undefined,
    queryFn: async () => {
      const to = market.data?.date;
      if (to === undefined) throw new Error("No session to measure from.");

      // The dates come along, not just the closes: a sparkline a reader can hover needs to
      // say which session a point belongs to, and a bare array of numbers cannot.
      const days = await nepse().closes({ from: rangeStart(to, TREND_DAYS), to });
      const series = new Map<string, TrendPoint[]>();
      for (const day of days) {
        for (const [symbol, close] of day.closes) {
          const points = series.get(symbol);
          if (points === undefined) series.set(symbol, [{ date: day.date, close }]);
          else points.push({ date: day.date, close });
        }
      }
      return series;
    },
  });

  if (market.error) {
    return (
      <div role="alert" className="rounded-lg border border-[var(--down)] bg-[var(--surface)] p-5 text-sm">
        <p className="font-medium">The archive could not be read.</p>
        <p className="mt-1 text-[var(--ink-2)]">{market.error.message}</p>
      </div>
    );
  }

  /*
   * The page draws itself before its data arrives, which it did not use to.
   *
   * It returned a skeleton for the whole route, so a reader spent the first moments of the
   * page looking at a grey rectangle where a headline, an install command and a terminal
   * belong. Almost nothing here is data: the headline, the standfirst, the section
   * headings, the card titles, the table's columns and the terminal's chrome are all fixed,
   * and only the figures inside them wait. So those are drawn immediately and each figure
   * gets a placeholder in its own place.
   *
   * There is a second effect and it is the one that is easy to miss: a layout that reserves
   * the right space is a layout that does not move when the data lands. The shift Lighthouse
   * reports here was largely a skeleton of the wrong height being replaced by the real
   * thing.
   */
  const data = market.data;
  const summary = data === undefined ? null : summarise(data.rows);

  const ranked = data === undefined ? null : {
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
  const firstDate = points[0]?.date ?? data?.date;

  return (
    // `aria-busy` for the region, and one status line rather than a live region over the
    // whole page: the figures arriving one by one are not news, "this is still loading" is.
    <div className="space-y-12" aria-busy={data === undefined}>
      {data === undefined && (
        <p role="status" className="sr-only">
          Reading the archive
        </p>
      )}

      <Hero market={data} />

      {/* The market pulse. One heading, one control row above what it scopes, one panel. */}
      <section className="space-y-5">
        <SectionHeading
          eyebrow="Market pulse"
          title="Equal-weighted market index"
          note={
            data === undefined ? (
              <Skeleton className="h-4 w-64 align-middle" />
            ) : index.isPending ? (
              "Reading sessions"
            ) : indexChange === null ? (
              "Not enough sessions in this range."
            ) : (
              <>
                <span className={`font-medium ${indexChange > 0 ? "text-[var(--up-ink)]" : "text-[var(--down-ink)]"}`}>
                  {indexChange > 0 ? "+" : "−"}
                  {Math.abs(indexChange).toFixed(2)}%
                </span>{" "}
                over {count(points.length)} sessions, {sessionDate(firstDate ?? data.date)} to{" "}
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

        {/* Breadth first, then the session's totals: the shape of the day before its size.
            The tiles are drawn either way, so the row is the same height before and after
            the figures land. */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Advanced" value={summary === null ? <Skeleton className="h-6 w-12" /> : count(summary.advancing)} tone="up" />
          <StatTile label="Declined" value={summary === null ? <Skeleton className="h-6 w-12" /> : count(summary.declining)} tone="down" />
          <StatTile label="Unchanged" value={summary === null ? <Skeleton className="h-6 w-12" /> : count(summary.unchanged)} tone="flat" />
          <StatTile
            icon={<Grid size={14} />}
            label="Scrips traded"
            value={summary === null ? <Skeleton className="h-6 w-12" /> : count(summary.scrips)}
          />
          <StatTile
            icon={<Banknote size={14} />}
            label="Turnover"
            value={summary === null ? <Skeleton className="h-6 w-20" /> : turnover(summary.turnover)}
          />
          <StatTile
            icon={<Activity size={14} />}
            label="Shares traded"
            value={summary === null ? <Skeleton className="h-6 w-20" /> : volume(summary.volume)}
          />
        </div>
      </section>

      {/*
        The exchange's levels, when the archive publishes them.

        Rendered only when there is something to render: an archive predating the artifact
        gives an empty array, and an empty grid under a heading is worse than no heading.
      */}
      {(levels.isPending || (levels.data !== undefined && levels.data.length > 0)) && (
        <section className="space-y-5">
          <SectionHeading
            eyebrow="Major indices"
            title="The exchange's own levels"
            note={
              <>
                NEPSE&rsquo;s published indices, not a computed one. The equal-weighted index
                above is this site&rsquo;s arithmetic over the same sessions, which is why
                the two are described separately rather than shown as one row.
              </>
            }
          />

          {levels.data === undefined ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <IndexGrid levels={levels.data} />
          )}
        </section>
      )}

      {/* Movers first, grouped because they are the same shape and so the same height. */}
      <section className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Top gainers" note="by change %" accent="up">
          {ranked === null ? <Rows /> : <ScripList rows={ranked.gainers} figure={(row) => <Change row={row} />} />}
        </Card>

        <Card title="Top losers" note="by change %" accent="down">
          {ranked === null ? <Rows /> : <ScripList rows={ranked.losers} figure={(row) => <Change row={row} />} />}
        </Card>

        <Card title="Most traded" note="by turnover" accent="market">
          {ranked === null ? <Rows /> : <ScripList rows={ranked.byTurnover} figure={(row) => turnover(row.turnover)} />}
        </Card>

        <Card title="Busiest by volume" note="shares" accent="market">
          {ranked === null ? <Rows /> : <ScripList rows={ranked.byVolume} figure={(row) => volume(row.volume)} />}
        </Card>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-3">
        <Card title="Breadth" note={data === undefined ? " " : sessionDate(data.date)} accent="market">
          {summary === null ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : (
            <Breadth
              advancing={summary.advancing}
              declining={summary.declining}
              unchanged={summary.unchanged}
              unknown={summary.unknown}
            />
          )}
        </Card>

        <Card title="The day" note={data === undefined ? " " : sessionDate(data.date)} accent="neutral">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            {[
              { label: "Scrips traded", value: summary === null ? null : count(summary.scrips) },
              { label: "Turnover", value: summary === null ? null : turnover(summary.turnover) },
              { label: "Shares traded", value: summary === null ? null : volume(summary.volume) },
              {
                label: "Compared with",
                value:
                  data === undefined
                    ? null
                    : data.previousDate === null
                      ? "Nothing"
                      : sessionDate(data.previousDate),
              },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-[var(--muted)]">{item.label}</dt>
                <dd className="tabular mt-0.5 text-lg font-semibold">
                  {item.value ?? <Skeleton className="h-5 w-16" />}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card
          title="Archive coverage"
          note={data === undefined ? " " : `${count(data.sessionsInArchive)} sessions since 2011`}
          accent="archive"
        >
          {data === undefined ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : (
            <CoverageColumns years={data.years} />
          )}
        </Card>
      </section>

      <section id="market" className="space-y-5 scroll-mt-6">
        <SectionHeading
          title="Every listed security"
          note={
            <>
              {data === undefined ? <Skeleton className="h-4 w-20 align-middle" /> : sessionDate(data.date)}
              {data === undefined ? null : "."}{" "}
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
        {data === undefined ? (
          <Skeleton className="h-[32rem] w-full rounded-xl" />
        ) : (
          <MarketTable rows={data.rows} trends={trends.data} />
        )}
      </section>
    </div>
  );
}

/**
 * The rows of a top-five list, before the list exists.
 *
 * Five, because that is what the real lists hold, and the same height as a scrip row, so
 * the card is the size it will be.
 */
function Rows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full rounded-md" />
      ))}
    </div>
  );
}
