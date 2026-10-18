/**
 * Telling a repeated session apart from a real one.
 *
 * ## Why the site has to check this at all
 *
 * The archive is written by a scraper that takes a session's date from the source rather
 * than from the clock, so a closed day normally writes nothing. But the source can serve
 * the previous session's figures under a new heading — after a holiday, or while its own
 * data pipeline is stuck — and the daily job writes what it is given. Two dates then hold
 * the same prices.
 *
 * Showing that second date would be a quiet lie of the worst kind: the page would say
 * "16 Oct 2026", every scrip would show a day change of exactly zero, and nothing on
 * screen would explain why. Comparing the new session with the one before it is enough to
 * catch it, because two different sessions cannot legitimately agree on every price, every
 * volume and every turnover figure.
 *
 * ## Exact equality, not a similarity threshold
 *
 * The archive's own backfill uses a hash of the whole CSV for the same check. A threshold
 * ("95% of rows match") would need a calibrated cut-off, and the cost of setting it too
 * low is rejecting a real, quiet day; the cost of setting it too high is showing a
 * duplicate. Exact equality has neither problem: a real session that matches its
 * predecessor in every field is not something a market of hundreds of scrips produces.
 */

import type { DatedCloses, Quote, Session } from "@srijankarki44/nepse-data";

/** The fields that make two quotes the same row of the same day. */
type ComparableQuote = Pick<Quote, "open" | "high" | "low" | "close" | "volume" | "turnover">;

function sameQuote(a: ComparableQuote, b: ComparableQuote): boolean {
  return (
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume &&
    a.turnover === b.turnover
  );
}

/**
 * Whether `current` repeats `previous` in full.
 *
 * The symbol set has to match too, not only the figures: a session that dropped one scrip
 * and gained another with the same prices is not the same day. An empty session is never a
 * repeat; it is a broken read, and the caller treats it separately so the two reasons can
 * be said differently to the reader.
 */
export function isRepeatedSession(current: Session, previous: Session): boolean {
  if (current.rows.length === 0 || current.rows.length !== previous.rows.length) return false;

  const earlier = new Map(previous.rows.map((row) => [row.symbol, row]));

  for (const row of current.rows) {
    const before = earlier.get(row.symbol);
    if (before === undefined || !sameQuote(row, before)) return false;
  }

  return true;
}

/**
 * Whether two days hold the same closing prices for the same scrips.
 *
 * The `closes` files carry only closes, so this is the strongest check available on the
 * index path. It is weaker than {@link isRepeatedSession}: a real day could, in principle,
 * close every scrip flat. Across the hundreds of scrips the archive lists that does not
 * happen, and treating it as a repeat is safer than drawing a false plateau in the index.
 */
export function sameCloses(a: DatedCloses, b: DatedCloses): boolean {
  if (a.closes.size !== b.closes.size) return false;

  for (const [symbol, close] of a.closes) {
    if (b.closes.get(symbol) !== close) return false;
  }

  return true;
}

/**
 * Drops days that repeat the last kept day, keeping the input order.
 *
 * `computeMarketIndex` sorts before calling this; the trends query gets its days already
 * ascending from `closes()`. Comparing against the last **kept** day rather than the
 * immediately preceding row is deliberate: a closure that the source republished for
 * three days produces three copies of one session, and all three should collapse.
 */
export function dropRepeatedCloses(days: readonly DatedCloses[]): DatedCloses[] {
  const kept: DatedCloses[] = [];

  for (const day of days) {
    const last = kept.at(-1);
    if (last !== undefined && sameCloses(last, day)) continue;
    kept.push(day);
  }

  return kept;
}
