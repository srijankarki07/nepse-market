/**
 * Turning the archive into the market the page shows.
 *
 * ## Why this is separate from the page
 *
 * It is where the rules live — how a day change is decided, which session is safe to show,
 * and when two sessions are actually one — and a rule buried in a component is a rule
 * nobody tests. The page fetches; this decides.
 *
 * ## The newest date in the manifest is not always readable
 *
 * `latest.json` is derived from the files on disk, so on the archive's own host it and the
 * session file it names appear together. Between a reader and those files sit a CDN and a
 * browser cache, and either can know about one before the other. The manifest can name a
 * session whose file is not available yet, and it can also name a session that merely
 * repeats the one before it because the source was still serving yesterday's figures.
 *
 * Neither is a reason to show an error page. The newest *verifiable* session is the one to
 * show, and the page says which dates were skipped and why. What is not allowed is falling
 * through to `null` silently: a reader looking at 15 October should be told that the
 * archive also names 16 October and why it is not on screen.
 *
 * ## A change is only a change when both sides are known
 *
 * Three cases each produce `null` rather than a number, and conflating any of them with
 * zero would be a lie the table tells:
 *
 *   - the previous session was not read, so there is no baseline;
 *   - the scrip did not trade in the previous session, newly listed, or suspended;
 *   - the previous close was itself zero, so a percentage against it is undefined.
 *
 * A previous session that cannot be read stops the walk: comparing against a date two
 * sessions back would measure a multi-day move and label it a day change.
 *
 * In each the table shows a dash. A day change of `0.00` means the price did not move,
 * which is a different statement entirely.
 */

import {
  ArchiveFormatError,
  ArchiveUnavailableError,
  SessionNotFoundError,
  SymbolNotFoundError,
  type DatedQuote,
  type ManifestResult,
  type Quote,
  type RangeOptions,
  type Session,
  type SymbolDirectory,
} from "@srijankarki44/nepse-data";

import { rangeStart } from "./nepse";
import { isRepeatedSession } from "./repeats";

export interface MarketRow extends Quote {
  /** The company name, when the archive has one. */
  name: string | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
}

/** Something the archive named but the page is deliberately not showing. */
export type MarketNoticeKind =
  /** A date in or beside the manifest whose session file could not be read. */
  | "unavailable"
  /** A date whose session file holds no scrips at all. */
  | "empty"
  /** A date whose figures are identical to the session before it. */
  | "repeated"
  /** The baseline for the day change could not be read, so changes are unknown. */
  | "previous-unavailable"
  /** The archive's session list could not be read, so the baseline cannot be verified. */
  | "session-list-unavailable"
  /** The archive has not published anything for long enough to be worth saying. */
  | "stale";

export interface MarketNotice {
  kind: MarketNoticeKind;
  /** The date the notice is about: the skipped date, or the shown date for `stale`. */
  date: string;
}

export interface Market {
  /** The session these prices are from. The newest one that could be verified. */
  date: string;
  /** The newest date the manifest names, which may not be the one on screen. */
  newestDate: string;
  /** The session before it, or `null` when no baseline could be read. */
  previousDate: string | null;
  rows: MarketRow[];
  /** Session count in the archive, from the index. */
  sessionsInArchive: number;
  /** Sessions per year, from the index, what the coverage chart plots. */
  years: Record<string, number>;
  /** Dates the manifest named but this page is not showing, and why. */
  notices: MarketNotice[];
}

/**
 * The failures this module raises itself, as distinct from the client's.
 *
 * `empty` is a fact about the archive and will not change by retrying. `no-session` means
 * the archive names dates but none of them could be read just now, which a retry can fix.
 */
export class MarketDataError extends Error {
  readonly kind: "empty" | "no-session";

  constructor(kind: "empty" | "no-session", message: string) {
    super(message);
    this.name = "MarketDataError";
    this.kind = kind;
  }
}

/** What `loadMarket` needs. The package's client satisfies it; tests supply a smaller one. */
export interface MarketSource {
  manifest(): Promise<ManifestResult>;
  session(date: string): Promise<Session>;
  sessionDates(range: { from: string; to: string }): Promise<string[]>;
  sessions(range: RangeOptions): Promise<Session[]>;
  directory(): Promise<SymbolDirectory>;
}

/**
 * How far back to look when the newest session will not load.
 *
 * Enough for an ordinary holiday and for a duplicate that the source repeated across one;
 * not so far that a broken archive turns into dozens of requests before the page reports
 * that it has nothing. The date list makes the walk cheap; only dates it actually names
 * are fetched.
 */
const LOOKBACK_DAYS = 45;

/**
 * How far back to walk session files when the archive's date list is unavailable.
 *
 * This path fetches every session in the window, so it is deliberately shorter than the
 * date-list lookback. Two weeks covers a public holiday; a longer closure is not a
 * fallback situation, because the manifest's own pair is then the ordinary path.
 */
const WALK_DAYS = 14;

/** How many skipped dates to report. Beyond a handful the list stops being readable. */
const MAX_NOTICES = 5;

/**
 * How many older dates a fallback will try.
 *
 * The date list names trading days, so this is rarely reached; the session walk fetches
 * every calendar day in its window, and a cap is what keeps a broken archive from turning
 * one page load into a month of probes. Twenty sessions is far more than a holiday or a
 * short outage needs.
 */
const MAX_CANDIDATES = 20;

/**
 * A date with no archive for long enough to be worth saying out loud.
 *
 * Ten days clears a normal week's closure and the longest public holiday the market takes;
 * a gap longer than that means the archive's daily job has stopped, and a reader looking
 * at a price deserves to know that rather than infer it from the date alone.
 */
const STALE_DAYS = 10;

const DAY_MS = 86_400_000;

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
 * Whether a date list is really just every calendar day.
 *
 * The client's `sessionDates()` is exact when the archive publishes `sessions.json`, but
 * when that file cannot be read it falls back to `eachDay()` and returns every day in the
 * range — with no error to tell the two apart. That matters here: a missing file for a
 * Saturday is not a missing session, and treating it as one would both invent notices and
 * stop a baseline walk at the first weekend.
 *
 * The two shapes are distinguishable over the 45-day lookback: a real session list has
 * gaps for weekends and holidays, while the calendar walk has none. A complete, gapless
 * range is therefore the calendar walk; anything with a gap is the archive's own list.
 */
function isEveryCalendarDay(dates: readonly string[], from: string, to: string): boolean {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return false;

  const sorted = [...new Set(dates)].sort();
  const expected = Math.floor((end - start) / DAY_MS) + 1;
  if (sorted.length !== expected) return false;

  return sorted.every((date, index) => Date.parse(`${date}T00:00:00Z`) === start + index * DAY_MS);
}

interface OlderDates {
  /**
   * Whether every date is known to be a session date.
   *
   * `true` when the archive published its date list. `false` when the list was unavailable
   * and the sessions were discovered by walking, in which case the gaps are unknown: an
   * unreadable file between two readable sessions may have been a holiday or a session
   * that could not be loaded, and the walk cannot tell.
   */
  exact: boolean;
  /** The candidate dates, newest first. Only readable sessions when `exact` is false. */
  dates: string[];
}

/**
 * Candidate session dates older than `date`, newest first.
 *
 * Only called when the manifest's own pair was not enough, so the ordinary page load —
 * newest session and the one before it, both readable — never pays for the date list.
 *
 * `seen` is what has already been tried. Excluding it keeps a walk from asking about the
 * same date twice.
 */
async function olderDates(
  source: MarketSource,
  date: string,
  seen: ReadonlySet<string>,
): Promise<OlderDates> {
  const usable = (candidate: string): boolean => candidate < date && !seen.has(candidate);

  try {
    const from = rangeStart(date, LOOKBACK_DAYS);
    const known = await source.sessionDates({ from, to: date });

    if (!isEveryCalendarDay(known, from, date)) {
      return {
        exact: true,
        dates: known.filter(usable).sort().reverse().slice(0, MAX_CANDIDATES),
      };
    }

    // The list was the client's calendar walk, not the archive's. Fall through to the
    // session walk, which returns only sessions that actually loaded.
  } catch {
    // The date list could not be read at all. The session walk below is the fallback.
  }

  try {
    const from = rangeStart(date, WALK_DAYS);
    const recent = await source.sessions({ from, to: date });
    return {
      exact: false,
      dates: recent
        .map((session) => session.date)
        .filter(usable)
        .sort()
        .reverse()
        .slice(0, MAX_CANDIDATES),
    };
  } catch {
    return { exact: false, dates: [] };
  }
}

/** The date a notice is about, as a UTC day number, or `null` when it is not a date. */
function dayNumber(date: string): number | null {
  const at = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(at) ? null : Math.floor(at / DAY_MS);
}

/**
 * Whether `candidate` is the calendar day immediately before `current`.
 *
 * This is the one gap a session walk can trust: if the two dates are adjacent, there is no
 * day between them for a failed session to hide on, so the earlier one really is the
 * immediate predecessor.
 */
function isPreviousDay(candidate: string, current: string): boolean {
  const before = dayNumber(candidate);
  const after = dayNumber(current);
  return before !== null && after !== null && after - before === 1;
}

function isStale(date: string, nowMs: number): boolean {
  const then = dayNumber(date);
  const today = Math.floor(nowMs / DAY_MS);
  return then !== null && today - then > STALE_DAYS;
}

interface ResolvedSessions {
  current: Session;
  previous: Session | null;
  notices: MarketNotice[];
}

/**
 * The newest session that can be read, the one before it, and what was skipped.
 *
 * The manifest's pair is tried first, because it is exact and usually enough: two session
 * requests, no date list. Everything after that is an exceptional path, and it is walked
 * only far enough to find a session that can be shown and a baseline that is genuinely the
 * one before it.
 */
async function resolveSessions(
  source: MarketSource,
  manifest: ManifestResult,
  nowMs: number,
): Promise<ResolvedSessions> {
  if (manifest.latest === null) {
    throw new MarketDataError("empty", "The archive is empty. It holds no sessions yet.");
  }

  const latest = manifest.latest;
  const notices: MarketNotice[] = [];
  const seen = new Set<string>();

  const note = (kind: MarketNoticeKind, date: string): void => {
    if (notices.length < MAX_NOTICES) notices.push({ kind, date });
  };

  const load = async (date: string): Promise<Session | null> => {
    try {
      return await source.session(date);
    } catch (error) {
      // A date the market did not trade, or one whose file has not reached this host yet.
      // Both mean "try the one before"; a network or format failure is different and is
      // allowed to abort the load.
      if (error instanceof SessionNotFoundError) return null;
      throw error;
    }
  };

  // The newest session, when the manifest names a usable one.
  let current: Session | null = null;
  seen.add(latest);

  const newest = await load(latest);
  if (newest === null) note("unavailable", latest);
  else if (newest.rows.length === 0) note("empty", latest);
  else current = newest;

  // The manifest's own baseline, when there is a newest session to compare it with.
  let previous: Session | null = null;
  let baselineBlocked = false;
  let baselineUnverified = false;

  if (current !== null && manifest.previous !== null) {
    seen.add(manifest.previous);

    const earlier = await load(manifest.previous);
    if (earlier === null) {
      // The immediately preceding session is missing. Walking past it would compare the
      // shown session with a date two or more sessions back and label the result a day
      // change, so the change is withheld instead.
      note("previous-unavailable", manifest.previous);
      baselineBlocked = true;
    } else if (earlier.rows.length === 0) {
      note("empty", manifest.previous);
      baselineBlocked = true;
    } else if (isRepeatedSession(current, earlier)) {
      // The source filed the same figures under two dates. The newer one is not a session,
      // so the older one becomes the session on screen and the walk continues from there.
      note("repeated", current.date);
      current = earlier;
    } else {
      previous = earlier;
    }
  }

  // The newest date was unusable, so promote the newest one that is not.
  if (current === null) {
    const older = await olderDates(source, latest, seen);

    for (const date of older.dates) {
      seen.add(date);
      const session = await load(date);

      if (session === null) {
        // Only the archive's own list can say a date was a session. In a walk, a day with
        // no file is just a day the market did not trade.
        if (older.exact) note("unavailable", date);
        continue;
      }
      if (session.rows.length === 0) {
        if (older.exact) note("empty", date);
        continue;
      }

      current = session;
      break;
    }
  }

  if (current === null) {
    throw new MarketDataError(
      "no-session",
      "None of the archive's recent sessions could be read just now.",
    );
  }

  // The baseline is still unknown: either a repeat moved the session on screen, or the
  // manifest named no previous at all. Walk back from the session actually being shown.
  if (previous === null && !baselineBlocked) {
    const older = await olderDates(source, current.date, seen);

    for (const date of older.dates) {
      seen.add(date);
      const earlier = await load(date);

      if (earlier === null) {
        if (older.exact) note("previous-unavailable", date);
        else baselineUnverified = true;
        break;
      }
      if (earlier.rows.length === 0) {
        if (older.exact) note("empty", date);
        else baselineUnverified = true;
        break;
      }

      if (isRepeatedSession(current, earlier)) {
        note("repeated", current.date);
        current = earlier;
        continue;
      }

      // An exact list says these two dates are consecutive sessions, so this is a day
      // change. A walk cannot say that in general — a day with no file between them may
      // have been a session that failed to load — but it can say it when the two dates are
      // adjacent, because then there is no day between them to have failed. Anything wider
      // is withheld rather than labelled as one day's move.
      if (older.exact || isPreviousDay(earlier.date, current.date)) {
        previous = earlier;
      } else {
        baselineUnverified = true;
      }
      break;
    }

    // A walk that ran out of candidates without finding a safe baseline is just as
    // unverified as one that stopped at a gap; both leave the change as a dash.
    if (previous === null && !older.exact) baselineUnverified = true;
  }

  if (baselineUnverified) {
    note("session-list-unavailable", current.date);
  }

  // Said in addition to any skip notice, because they answer different questions: a skip
  // explains why the newest date is missing, and this says the session on screen is itself
  // far enough behind to suggest the daily job has stopped.
  if (isStale(current.date, nowMs)) {
    note("stale", current.date);
  }

  return { current, previous, notices };
}

/**
 * Everything the overview page needs.
 *
 * The directory is fetched alongside the sessions rather than awaited first, because it is
 * a nicety: names, and the table is useful without it. A directory that will not load is
 * therefore an empty one, not a failed market.
 */
export async function loadMarket(
  client: MarketSource,
  options: { now?: () => number } = {},
): Promise<Market> {
  const manifest = await client.manifest();
  if (manifest.latest === null) {
    throw new MarketDataError("empty", "The archive is empty. It holds no sessions yet.");
  }

  // Captured after the guard so the narrowing survives into the closures below.
  const newestDate = manifest.latest;
  const now = options.now ?? Date.now;

  const [resolved, directory] = await Promise.all([
    resolveSessions(client, manifest, now()),
    client.directory().catch(() => ({}) as SymbolDirectory),
  ]);

  return {
    date: resolved.current.date,
    newestDate,
    previousDate: resolved.previous?.date ?? null,
    rows: buildMarket(resolved.current, resolved.previous, directory),
    sessionsInArchive: manifest.sessions,
    years: manifest.years,
    notices: resolved.notices,
  };
}

/** A failure described in the terms the page speaks, rather than in HTTP status codes. */
export interface MarketErrorDescription {
  title: string;
  detail: string;
  retryable: boolean;
}

/**
 * What to tell a reader when the archive cannot be read.
 *
 * The split that matters is retryable or not. "The archive is empty" and "the file is
 * malformed" are facts; a retry button would only teach the reader to press it. A network
 * failure, or a date that could not be loaded just now, may resolve on the next try.
 */
export function describeMarketError(error: unknown): MarketErrorDescription {
  if (error instanceof MarketDataError) {
    if (error.kind === "empty") {
      return { title: "The archive is empty.", detail: error.message, retryable: false };
    }

    return { title: "No market session could be read.", detail: error.message, retryable: true };
  }

  if (error instanceof SessionNotFoundError) {
    return { title: "That session is not in the archive.", detail: error.message, retryable: false };
  }

  if (error instanceof SymbolNotFoundError) {
    return { title: "That scrip is not in this session.", detail: error.message, retryable: false };
  }

  if (error instanceof ArchiveFormatError) {
    return {
      title: "The archive published something this site could not read.",
      detail: error.message,
      retryable: false,
    };
  }

  if (error instanceof ArchiveUnavailableError) {
    return { title: "The archive could not be reached.", detail: error.message, retryable: true };
  }

  if (error instanceof TypeError) {
    return {
      title: "The archive could not be reached.",
      detail:
        "The request failed before the archive answered. Check the connection and try again.",
      retryable: true,
    };
  }

  return {
    title: "The archive could not be read.",
    detail: error instanceof Error ? error.message : String(error),
    retryable: true,
  };
}

/** Whether a failed query is worth another request. Used by the query client's retry rule. */
export function isRetryableArchiveError(error: unknown): boolean {
  return describeMarketError(error).retryable;
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
