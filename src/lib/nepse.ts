/**
 * The one client, and the queries the pages make through it.
 *
 * ## One client for the whole app
 *
 * The client holds the cache — including a `localStorage` adapter, so a reload does not
 * refetch the session it just read. Session files never change, so that cache is not a
 * guess about freshness; it is a fact about the archive.
 *
 * Constructed lazily because `localStorage` does not exist while Next prerenders a page
 * on the server. The site is exported statically, but the build still renders each route
 * once in Node, where touching `window` would throw.
 *
 * ## Queries are keyed by what they actually depend on
 *
 * Every key carries the session date, so when the archive publishes a new day the market
 * queries miss and refetch while the symbol queries that have not changed stay cached.
 */

import { createClient, localStorageCache, memoryCache, type NepseDataClient } from "nepse-data";

let client: NepseDataClient | null = null;

/** The shared client. Safe to call during prerender — it just will not persist. */
export function nepse(): NepseDataClient {
  client ??= createClient({
    // Falls back to memory where storage is unavailable, which includes the server during
    // a static export and any browser that has it blocked.
    cache: typeof window === "undefined" ? memoryCache() : localStorageCache(),
  });

  return client;
}

/**
 * The session-range options the symbol page offers.
 *
 * Deliberately short by default. A year is 230 session files — roughly a megabyte and a
 * few seconds cold — and the archive's data is end-of-day, so a chart of it is a
 * long-horizon view rather than something anyone reads intraday.
 */
export const RANGES = [
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1y", label: "1Y", days: 365 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

/** The `from` date for a range, relative to a session date. */
export function rangeStart(latest: string, days: number): string {
  const start = Date.parse(`${latest}T00:00:00Z`) - days * 86_400_000;
  return new Date(start).toISOString().slice(0, 10);
}
