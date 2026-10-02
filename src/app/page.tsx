"use client";

/**
 * The market overview: every scrip, for the most recent session.
 *
 * ## Loading is one file, not a query
 *
 * The archive publishes a whole session as a single file, so this page is four requests
 * whatever the market is doing — the index, the session, the session before it for the
 * day change, and the ticker directory. That is the shape the archive was built for, and
 * it is why there is nothing to paginate.
 *
 * ## The date on screen is the archive's, never the clock
 *
 * The heading reads `latest` from the index. A reader who sees "today" assumes the prices
 * are today's, and on a holiday — or before the daily job has run — they are not. The
 * archive is the only thing that knows which session it holds, so it is the only thing
 * asked.
 */

import { useQuery } from "@tanstack/react-query";

import { MarketTable } from "@/components/market-table";
import { count, percent, sessionDate, turnover, volume } from "@/lib/format";
import { loadMarket, summarise } from "@/lib/market";
import { nepse } from "@/lib/nepse";

export default function MarketPage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["market"],
    queryFn: () => loadMarket(nepse()),
  });

  if (isPending) return <Loading />;

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100"
      >
        <p className="font-medium">The archive could not be read.</p>
        <p className="mt-1 opacity-90">{error.message}</p>
      </div>
    );
  }

  const summary = summarise(data.rows);

  // Breadth is over the scrips that moved at all. Including the unknowns would drag it
  // toward the middle for reasons that have nothing to do with the market.
  const moved = summary.advancing + summary.declining;
  const breadth = moved === 0 ? null : (summary.advancing / moved) * 100;

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Session of <strong className="font-medium">{sessionDate(data.date)}</strong>
          {data.previousDate !== null && <> · against {sessionDate(data.previousDate)}</>} ·{" "}
          {count(data.sessionsInArchive)} sessions archived since 2011
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Scrips traded" value={count(summary.scrips)} />
        <Stat
          label="Advancing / declining"
          value={`${count(summary.advancing)} / ${count(summary.declining)}`}
          detail={breadth === null ? undefined : `${percent(breadth - 50)} breadth`}
        />
        <Stat label="Turnover" value={turnover(summary.turnover)} detail="total, NPR" />
        <Stat label="Volume" value={volume(summary.volume)} detail="shares" />
      </section>

      {summary.unknown > 0 && (
        // Said out loud rather than left as unexplained dashes. A reader who cannot tell
        // "no data" from "did not move" will read the dashes as zeros.
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {count(summary.unknown)} scrips show no day change: they did not trade in the
          previous session, or the previous session predates them.
        </p>
      )}

      <MarketTable rows={data.rows} />
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

function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
          />
        ))}
      </div>
      <p className="text-sm text-neutral-500">Reading the archive…</p>
    </div>
  );
}
