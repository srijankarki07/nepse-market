/**
 * A market index, derived from the archive.
 *
 * ## Why one is needed, and why this one is honest
 *
 * NEPSE publishes its own indices and the archive does not carry them, it is eight
 * columns of per-scrip prices and nothing else. But "how did the market move" is the
 * first question anyone asks of a market site, and it cannot be answered by pointing at
 * one scrip.
 *
 * So this computes an **equal-weighted** index: the average of each scrip's day-on-day
 * price ratio, chained forward from 100. It is the simplest defensible construction, and
 * it is named for what it is rather than presented as *the* NEPSE index, which it is not.
 * An actual NEPSE index is capitalisation-weighted over a defined basket; without market
 * capitalisation in the archive, that cannot be reproduced and is not attempted.
 *
 * What it does say is true: it is the return an investor would have earned holding every
 * listed scrip in equal amounts and rebalancing daily. That is a real quantity, and the
 * UI labels it as equal-weighted wherever it appears.
 *
 * ## Scrips missing from either side of a day are dropped for that day
 *
 * A ratio needs both prices. A scrip that did not trade yesterday has no ratio, and
 * carrying yesterday's price forward would invent a flat day for a scrip that may have
 * moved sharply when it reopened. Dropping it means the index measures the scrips that
 * actually traded on both days, which is the honest population.
 *
 * A day where **nothing** traded is skipped entirely rather than carried flat: a market
 * that was shut is not a day of zero return, and plotting it as one would draw a false
 * plateau.
 */

import type { Session } from "nepse-data";

export interface IndexPoint {
  date: string;
  /** Index level, 100 at the first session in the series. */
  value: number;
  /** How many scrips contributed a ratio that day. */
  constituents: number;
}

export interface MarketIndex {
  points: IndexPoint[];
  /** Percent change from the first point to the last. `null` when there are fewer than two. */
  changePercent: number | null;
}

/** The closes in one session, keyed by ticker. Scrips with no close are omitted. */
function closesOf(session: Session): Map<string, number> {
  const closes = new Map<string, number>();
  for (const row of session.rows) {
    if (row.close !== null) closes.set(row.symbol, row.close);
  }
  return closes;
}

/**
 * The mean day-on-day ratio between two sessions, or `null` when they share no scrip.
 *
 * Ratio-of-means is deliberately avoided: it would weight a scrip trading at 10,000 the
 * same as one at 100 by price, which is not what "equal-weighted" means. This is the mean
 * of the ratios, which weights each *scrip* equally.
 */
export function meanRatio(previous: Session, current: Session): number | null {
  const before = closesOf(previous);
  const now = closesOf(current);

  let total = 0;
  let counted = 0;

  for (const [symbol, close] of now) {
    const earlier = before.get(symbol);
    // A zero or absent previous close has no ratio, and dividing by it would produce
    // Infinity and poison the whole series from that day forward.
    if (earlier === undefined || earlier === 0) continue;

    total += close / earlier;
    counted += 1;
  }

  return counted === 0 ? null : total / counted;
}

/** The equal-weighted index across a run of sessions, ascending by date. */
export function computeMarketIndex(sessions: readonly Session[]): MarketIndex {
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const first = ordered[0];
  if (first === undefined) return { points: [], changePercent: null };

  const points: IndexPoint[] = [
    { date: first.date, value: 100, constituents: closesOf(first).size },
  ];

  let level = 100;

  // The last session that actually contributed. A skipped day must not become the
  // baseline for the next one: if Tuesday has no usable data, Wednesday's return is
  // measured from Monday, because that is the last price the market actually had. Using
  // the skipped day instead would compare Wednesday against nothing and drop the move
  // that happened across the gap.
  let baseline = first;

  for (let index = 1; index < ordered.length; index++) {
    const current = ordered[index];
    if (current === undefined) continue;

    const ratio = meanRatio(baseline, current);

    // A day sharing no scrip with the baseline is skipped rather than plotted flat. A
    // market that was shut is not a day of zero return.
    if (ratio === null) continue;

    baseline = current;
    level *= ratio;
    points.push({
      date: current.date,
      value: Number(level.toFixed(4)),
      constituents: closesOf(current).size,
    });
  }

  const last = points.at(-1);
  const changePercent =
    last === undefined || points.length < 2 ? null : Number((last.value - 100).toFixed(4));

  return { points, changePercent };
}

/** The high and low index levels in a series, for annotating the chart. */
export function indexExtremes(index: MarketIndex): { high: IndexPoint | null; low: IndexPoint | null } {
  let high: IndexPoint | null = null;
  let low: IndexPoint | null = null;

  for (const point of index.points) {
    if (high === null || point.value > high.value) high = point;
    if (low === null || point.value < low.value) low = point;
  }

  return { high, low };
}
