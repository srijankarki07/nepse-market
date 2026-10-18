/**
 * The one client, and the queries the pages make through it.
 *
 * ## One client for the whole app
 *
 * The client holds the cache, including a `localStorage` adapter, so a reload does not
 * refetch the session it just read. Session files never change, so that cache is not a
 * guess about freshness; it is a fact about the archive.
 *
 * Constructed lazily because `localStorage` does not exist while Next prerenders a page
 * on the server. The site is exported statically, but the build still renders each route
 * once in Node, where touching `window` would throw.
 *
 * ## A 404 from the CDN is not always a fact about the archive
 *
 * The archive publishes `data/latest.json` and the session file it names in the same
 * commit, but jsDelivr learns about a branch commit at its own pace. For the few minutes
 * between the two, the manifest (read from the origin, which is current) can name a date
 * whose session file the CDN has not got yet. The client treats a 404 as "this date did
 * not trade" and remembers it **forever**, so one early visitor would see the error on
 * every reload until they cleared site data.
 *
 * Both halves are fixed here rather than in the pages: a fetch that asks the origin when
 * the CDN has no recent session file, and a cache that refuses to make "no session" a
 * permanent fact for a recent date.
 *
 * ## Queries are keyed by what they actually depend on
 *
 * Every key carries the session date, so when the archive publishes a new day the market
 * queries miss and refetch while the symbol queries that have not changed stay cached.
 */

import {
  CDN_HOST,
  ORIGIN_HOST,
  createClient,
  localStorageCache,
  memoryCache,
  type Cache,
  type NepseDataClient,
} from "@srijankarki44/nepse-data";

/**
 * How far back a missing session is treated as late rather than absent.
 *
 * A month is deliberately generous. The only cost is one extra origin request for a day
 * the CDN says it does not have; the thing it prevents is a permanent negative cache
 * entry for a session that was merely a few minutes behind the manifest.
 */
const RECENT_DAYS = 30;

const DAY_MS = 86_400_000;

/** `session/2026-10-16`, the client's cache key for one session file. */
const SESSION_KEY = /^session\/(\d{4}-\d{2}-\d{2})$/;

/** `data/daily/2026/2026-10-16.csv`, the path one session file is served at. */
const SESSION_PATH = /^data\/daily\/\d{4}\/(\d{4}-\d{2}-\d{2})\.csv$/;

/** Whether a date is recent enough that the archive may still be publishing it. */
export function isRecentArchiveDate(date: string, nowMs: number = Date.now()): boolean {
  const at = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(at)) return false;

  // A date after the reader's clock is recent too: the archive and the reader do not have
  // to agree about today, and a session published in Kathmandu can be "tomorrow" further
  // west for part of the day.
  return at >= nowMs - RECENT_DAYS * DAY_MS;
}

/**
 * `fetch` with one extra rule: a missing recent session on the CDN is retried at the origin.
 *
 * The transport already falls back to the other host when a request *fails*, but a 404 is
 * deliberately not a failure to it — it is the archive saying a date did not trade, and
 * retrying that would waste a request on every holiday. That is right for every date but
 * the newest few, where the CDN is the one that is behind rather than the archive.
 *
 * Only `data/daily/` is affected. Every other path is already read from the origin first,
 * because those files are rewritten in place and an edge copy of one can be hours old.
 */
export function createArchiveFetch(fetchImpl: typeof fetch = globalThis.fetch): typeof fetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);

    // The client's transport asks `data/daily/` of the CDN first, and both a 404 and a 403
    // mean "not at this path" to it. Only a string URL can be the archive's own format;
    // anything else is passed through untouched.
    if (response.status !== 404 && response.status !== 403) return response;
    if (typeof input !== "string") return response;

    const prefix = `${CDN_HOST}/`;
    if (!input.startsWith(prefix)) return response;

    const path = input.slice(prefix.length);
    const file = SESSION_PATH.exec(path);
    const date = file?.[1];
    if (date === undefined || !isRecentArchiveDate(date)) return response;

    // The origin is the archive itself, so it knows about the file the moment the commit
    // exists. If it says 404 too, the caller is free to remember that.
    return fetchImpl(`${ORIGIN_HOST}/${path}`, init);
  };
}

/**
 * The browser cache, with recent negative session results ignored.
 *
 * The client's rule is that a session file is immutable, so a date with no file can be
 * remembered forever. That is true for a date the market did not trade and false for a
 * date whose file the CDN had not caught up with. The distinction is time: a negative
 * answer for a date within the last month is a claim that is still allowed to change.
 *
 * Dropping the `set` would be enough for new visitors. The `get` is what repairs a browser
 * that has already cached the bad answer, which is the state the site's first readers are
 * in.
 */
export function createRecentSafeCache(
  inner: Cache,
  nowMs: () => number = Date.now,
): Cache {
  const recentNegative = (key: string, value: string): boolean => {
    if (value !== "") return false;
    const match = SESSION_KEY.exec(key);
    const date = match?.[1];
    return date !== undefined && isRecentArchiveDate(date, nowMs());
  };

  return {
    async get(key) {
      const value = await inner.get(key);
      return recentNegative(key, value ?? "") ? null : value;
    },
    async set(key, value) {
      if (recentNegative(key, value)) return;
      await inner.set(key, value);
    },
  };
}

let client: NepseDataClient | null = null;

/** The shared client. Safe to call during prerender, it just will not persist. */
export function nepse(): NepseDataClient {
  client ??= createClient({
    // Falls back to memory where storage is unavailable, which includes the server during
    // a static export and any browser that has it blocked.
    cache:
      typeof window === "undefined"
        ? memoryCache()
        : createRecentSafeCache(localStorageCache()),
    fetch: createArchiveFetch(),
  });

  return client;
}

/**
 * The session-range options the symbol page offers.
 *
 * Deliberately short by default. A year is 230 session files, roughly a megabyte and a
 * few seconds cold (the archive's data is end-of-day), so a chart of it is a
 * long-horizon view rather than something anyone reads intraday.
 */
export const RANGES = [
  { key: "1w", label: "1W", days: 7 },
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
