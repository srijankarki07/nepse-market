/**
 * Turning two sessions and a directory into a market table.
 *
 * ## Why this is separate from the page
 *
 * It is the only piece of this site with a rule in it worth testing — how a day change is
 * decided — and a rule buried in a component is a rule nobody tests. The page fetches;
 * this decides.
 *
 * ## A change is only a change when both sides are known
 *
 * Three cases each produce `null` rather than a number, and conflating any of them with
 * zero would be a lie the table tells:
 *
 *   - the previous session was not read, so there is no baseline;
 *   - the scrip did not trade in the previous session — newly listed, or suspended;
 *   - the previous close was itself zero, so a percentage against it is undefined.
 *
 * In each the table shows a dash. A day change of `0.00` means the price did not move,
 * which is a different statement entirely.
 */

import type { DatedQuote, NepseDataClient, Quote, Session, SymbolDirectory } from "nepse-data";

export interface MarketRow extends Quote {
  /** The company name, when the archive has one. */
  name: string | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
}

export interface Market {
  /** The session these prices are from. */
  date: string;
  /** The session before it, or `null` when the archive holds only one. */
  previousDate: string | null;
  rows: MarketRow[];
  /** Session count in the archive, from the index. */
  sessionsInArchive: number;
  /** Sessions per year, from the index — what the coverage chart plots. */
  years: Record<string, number>;
}

/** The day change between two closes, or `null` when either is missing. */
export function dayChange(
  close: number | null,
  previousClose: number | null,
): { change: number | null; changePercent: number | null } {
  if (close === null || previousClose === null) return { change: null, changePercent: null };

  // Rounded to four places because the source publishes two, and binary floating point
  // turns `566 - 570` into something with a tail. A change shown as `-3.9999999999` reads
  // as a bug in the site rather than in arithmetic.
  const change = Number((close - previousClose).toFixed(4));

  return {
    change,
    changePercent: previousClose === 0 ? null : Number(((change / previousClose) * 100).toFixed(4)),
  };
}

/** Merges one session with the one before it and the ticker directory. */
export function buildMarket(
  current: Session,
  previous: Session | null,
  directory: SymbolDirectory,
): MarketRow[] {
  const previousCloseBySymbol = new Map<string, number | null>(
    previous?.rows.map((row) => [row.symbol, row.close]) ?? [],
  );

  return current.rows.map((row) => {
    const previousClose = previousCloseBySymbol.get(row.symbol) ?? null;
    const { change, changePercent } = dayChange(row.close, previousClose);

    return {
      ...row,
      name: directory[row.symbol]?.name ?? null,
      previousClose,
      change,
      changePercent,
    };
  });
}

/**
 * Everything the overview page needs, in four requests.
 *
 * The directory is fetched alongside rather than awaited first, because it is a nicety —
 * names — and the table is useful without it.
 */
export async function loadMarket(client: NepseDataClient): Promise<Market> {
  const manifest = await client.manifest();
  if (manifest.latest === null) {
    throw new Error("The archive is empty — it holds no sessions yet.");
  }

  const [current, previous, directory] = await Promise.all([
    client.session(manifest.latest),
    manifest.previous === null
      ? Promise.resolve(null)
      // A previous session that will not load is not a reason to show no market: the
      // changes go to dashes and everything else still renders.
      : client.session(manifest.previous).catch(() => null),
    client.directory(),
  ]);

  return {
    date: current.date,
    previousDate: previous?.date ?? null,
    rows: buildMarket(current, previous, directory),
    sessionsInArchive: manifest.sessions,
    years: manifest.years,
  };
}

/** Headline figures for the overview. */
export interface MarketSummary {
  scrips: number;
  advancing: number;
  declining: number;
  unchanged: number;
  /** Scrips with no day change available, for any of the reasons above. */
  unknown: number;
  turnover: number;
  volume: number;
}

export function summarise(rows: readonly MarketRow[]): MarketSummary {
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  let unknown = 0;
  let turnover = 0;
  let volume = 0;

  for (const row of rows) {
    if (row.change === null) unknown += 1;
    else if (row.change > 0) advancing += 1;
    else if (row.change < 0) declining += 1;
    else unchanged += 1;

    turnover += row.turnover ?? 0;
    volume += row.volume ?? 0;
  }

  return { scrips: rows.length, advancing, declining, unchanged, unknown, turnover, volume };
}

/** One scrip's series, for the symbol page's chart. */
export interface SeriesPoint extends DatedQuote {
  /** The date as the chart's x value. */
  label: string;
}

export function toSeries(points: readonly DatedQuote[]): SeriesPoint[] {
  return points.map((point) => ({ ...point, label: point.date }));
}
