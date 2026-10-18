/**
 * The day-change rule.
 *
 * This is the only real rule on the site, and it is the one most easily got wrong in a
 * way nobody notices: a change shown as `0.00` when the baseline is unknown looks exactly
 * like a price that did not move.
 */

import { describe, expect, it } from "vitest";
import {
  ArchiveFormatError,
  ArchiveUnavailableError,
  SessionNotFoundError,
  type ManifestResult,
  type Quote,
  type RangeOptions,
  type Session,
  type SymbolDirectory,
} from "@srijankarki44/nepse-data";

import {
  MarketDataError,
  buildMarket,
  dayChange,
  describeMarketError,
  loadMarket,
  summarise,
  type MarketSource,
} from "./market";

function quote(symbol: string, close: number | null, fields: Partial<Quote> = {}): Quote {
  return {
    symbol,
    open: null,
    high: null,
    low: null,
    close,
    volume: null,
    turnover: null,
    ...fields,
  };
}

function session(date: string, rows: Quote[]): Session {
  return { date, rows };
}

function manifest(latest: string | null, previous: string | null, sessions = 0): ManifestResult {
  return { latest, previous, sessions, years: {}, source: "test" };
}

/**
 * The smallest client `loadMarket` accepts.
 *
 * Sessions are a list rather than a map so a test reads as the archive it is describing;
 * a date that is not in the list is a date the archive does not hold, which the fake
 * answers with the same error the real client raises.
 */
function source(options: {
  manifest: ManifestResult;
  sessions: Session[];
  directory?: SymbolDirectory;
  /** Set false to make the archive's date list unavailable, exercising the walk fallback. */
  dateList?: boolean;
  /**
   * Answer `sessionDates` with every calendar day, the way the real client does when
   * `sessions.json` cannot be read. Distinct from `dateList: false`, which is the shape
   * of a client that refuses instead of walking.
   */
  calendarList?: boolean;
}): MarketSource {
  const byDate = new Map(options.sessions.map((entry) => [entry.date, entry]));
  const dates = options.sessions.map((entry) => entry.date).sort();

  return {
    manifest: async () => options.manifest,
    session: async (date) => {
      const found = byDate.get(date);
      if (found === undefined) {
        throw new SessionNotFoundError(
          `data/daily/${date}.csv`,
          404,
          `The archive has no session for ${date}.`,
        );
      }
      return found;
    },
    sessionDates: async ({ from, to }) => {
      if (options.dateList === false) throw new Error("The archive publishes no date list.");

      if (options.calendarList === true) {
        const days: string[] = [];
        for (
          let time = Date.parse(`${from}T00:00:00Z`);
          time <= Date.parse(`${to}T00:00:00Z`);
          time += 86_400_000
        ) {
          days.push(new Date(time).toISOString().slice(0, 10));
        }
        return days;
      }

      return dates.filter((date) => date >= from && date <= to);
    },
    sessions: async ({ from, to }: RangeOptions) =>
      dates
        .filter((date) => date >= from && date <= to)
        .map((date) => byDate.get(date))
        .filter((entry): entry is Session => entry !== undefined),
    directory: async () => options.directory ?? {},
  };
}

describe("dayChange", () => {
  it("computes a fall", () => {
    expect(dayChange(566, 570)).toEqual({
      change: -4,
      changePercent: expect.closeTo(-0.7018, 3),
    });
  });

  it("computes a rise", () => {
    expect(dayChange(570, 566).change).toBe(4);
  });

  it("reports no change as zero, which is a real answer", () => {
    // Distinct from the unknown cases below: the price genuinely did not move.
    expect(dayChange(570, 570).change).toBe(0);
    expect(dayChange(570, 570).changePercent).toBe(0);
  });

  it("has no change when there is no baseline", () => {
    expect(dayChange(566, null)).toEqual({ change: null, changePercent: null });
  });

  it("has no change when the close itself is missing", () => {
    expect(dayChange(null, 570)).toEqual({ change: null, changePercent: null });
  });

  it("has no percentage against a zero baseline", () => {
    // The change itself is knowable, 5 from nothing, but a percentage against nothing is
    // not a number, and rendering it as one would invent a figure.
    const result = dayChange(5, 0);
    expect(result.change).toBe(5);
    expect(result.changePercent).toBeNull();
  });

  it("does not leak floating-point tails into the display", () => {
    // `566.1 - 570.2` is not clean in binary, and a change rendered as `-4.100000000000023`
    // reads as a bug in the site rather than in arithmetic.
    const { change } = dayChange(566.1, 570.2);
    expect(String(change)).toBe("-4.1");
  });
});

describe("buildMarket", () => {
  const directory: SymbolDirectory = {
    NABIL: { name: "Nabil Bank Limited", lastSeen: "2026-10-01" },
  };

  it("attaches the previous close and the name", () => {
    const rows = buildMarket(
      session("2026-10-01", [quote("NABIL", 566)]),
      session("2026-09-30", [quote("NABIL", 570)]),
      directory,
    );

    expect(rows[0]).toMatchObject({
      symbol: "NABIL",
      close: 566,
      previousClose: 570,
      change: -4,
      name: "Nabil Bank Limited",
    });
  });

  it("gives a scrip absent from the previous session no change", () => {
    // Newly listed, or suspended. Either way there is no baseline and the table must say
    // so rather than showing a rise from nothing.
    const rows = buildMarket(
      session("2026-10-01", [quote("NEW", 100)]),
      session("2026-09-30", [quote("NABIL", 570)]),
      directory,
    );

    expect(rows[0]?.change).toBeNull();
    expect(rows[0]?.previousClose).toBeNull();
  });

  it("works with no previous session at all", () => {
    const rows = buildMarket(
      session("2026-10-01", [quote("NABIL", 566)]),
      null,
      directory,
    );

    expect(rows[0]?.change).toBeNull();
  });

  it("leaves the name null when the archive has none", () => {
    // A scrip delisted before the archive recorded names. The table falls back to the
    // ticker rather than failing.
    const rows = buildMarket(
      session("2026-10-01", [quote("OLD", 10)]),
      null,
      directory,
    );

    expect(rows[0]?.name).toBeNull();
  });
});

describe("summarise", () => {
  it("counts movers and totals the day", () => {
    const rows = buildMarket(
      session("2026-10-01", [
        { ...quote("A", 110), turnover: 100, volume: 10 },
        { ...quote("B", 90), turnover: 200, volume: 20 },
        { ...quote("C", 100), turnover: 300, volume: 30 },
      ]),
      session("2026-09-30", [
        quote("A", 100),
        quote("B", 100),
        quote("C", 100),
      ]),
      {},
    );

    const summary = summarise(rows);

    expect(summary).toMatchObject({
      scrips: 3,
      advancing: 1,
      declining: 1,
      unchanged: 1,
      unknown: 0,
      turnover: 600,
      volume: 60,
    });
  });

  it("counts an unknown change separately from an unchanged one", () => {
    // The bug this guards: folding unknowns into "unchanged" would make a market of
    // suspended scrips look perfectly flat.
    const rows = buildMarket(
      session("2026-10-01", [quote("A", 100)]),
      null,
      {},
    );

    const summary = summarise(rows);

    expect(summary.unknown).toBe(1);
    expect(summary.unchanged).toBe(0);
  });

  it("treats a missing turnover as zero for the total, which it is", () => {
    // Unlike a price, a missing turnover genuinely contributes nothing to a sum.
    const rows = buildMarket(
      session("2026-10-01", [quote("A", 100)]),
      null,
      {},
    );
    expect(summarise(rows).turnover).toBe(0);
  });
});

/**
 * Which session the page is allowed to show.
 *
 * The archive's newest date is a claim about what is on disk, not a promise that every
 * reader can fetch it. These are the states the page used to have no answer for: the file
 * is not available yet, the file is empty, and the file repeats the day before it.
 */
describe("loadMarket's session fallback", () => {
  const directory: SymbolDirectory = {
    A: { name: "Alpha Limited", lastSeen: "2026-10-16" },
  };

  it("shows the previous session when the newest named session is not available yet", async () => {
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-16", "2026-10-15", 3),
        sessions: [
          session("2026-10-14", [quote("A", 100, { volume: 10, turnover: 100 })]),
          session("2026-10-15", [quote("A", 110, { volume: 11, turnover: 121 })]),
        ],
        directory,
      }),
    );

    expect(market.date).toBe("2026-10-15");
    expect(market.previousDate).toBe("2026-10-14");
    expect(market.notices).toEqual([{ kind: "unavailable", date: "2026-10-16" }]);
    expect(market.rows[0]).toMatchObject({
      symbol: "A",
      close: 110,
      previousClose: 100,
      change: 10,
      name: "Alpha Limited",
    });
  });

  it("skips a session whose figures repeat the session before it", async () => {
    // The source served the 15th's page under the 16th's heading. Showing it would mark
    // every scrip unchanged on a day the market did not trade, and nothing would say why.
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-16", "2026-10-15", 3),
        sessions: [
          session("2026-10-14", [quote("A", 100, { volume: 10, turnover: 100 })]),
          session("2026-10-15", [quote("A", 110, { volume: 11, turnover: 121 })]),
          session("2026-10-16", [quote("A", 110, { volume: 11, turnover: 121 })]),
        ],
        directory,
      }),
    );

    expect(market.date).toBe("2026-10-15");
    expect(market.previousDate).toBe("2026-10-14");
    expect(market.notices).toEqual([{ kind: "repeated", date: "2026-10-16" }]);
    expect(market.rows[0]?.change).toBe(10);
  });

  it("skips a copied session and keeps walking through a run of copies", async () => {
    // A closure that the source republished for three days must collapse to the one real
    // session, not merely to the first copy.
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-17", "2026-10-16", 4),
        sessions: [
          session("2026-10-14", [quote("A", 100, { volume: 10, turnover: 100 })]),
          session("2026-10-15", [quote("A", 110, { volume: 11, turnover: 121 })]),
          session("2026-10-16", [quote("A", 110, { volume: 11, turnover: 121 })]),
          session("2026-10-17", [quote("A", 110, { volume: 11, turnover: 121 })]),
        ],
      }),
    );

    expect(market.date).toBe("2026-10-15");
    expect(market.previousDate).toBe("2026-10-14");
    expect(market.notices).toEqual([
      { kind: "repeated", date: "2026-10-17" },
      { kind: "repeated", date: "2026-10-16" },
    ]);
  });

  it("keeps a real session whose closes happen to match the previous one", async () => {
    // Identical closes are not enough on their own: the day's volume and turnover moved,
    // so this is a quiet trading day, not a copied one.
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-16", "2026-10-15", 3),
        sessions: [
          session("2026-10-14", [quote("A", 100, { volume: 10, turnover: 100 })]),
          session("2026-10-15", [quote("A", 110, { volume: 11, turnover: 121 })]),
          session("2026-10-16", [quote("A", 110, { volume: 12, turnover: 130 })]),
        ],
      }),
    );

    expect(market.date).toBe("2026-10-16");
    expect(market.previousDate).toBe("2026-10-15");
    expect(market.notices).toEqual([]);
  });

  it("skips a session file that holds no scrips", async () => {
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-16", "2026-10-15", 3),
        sessions: [
          session("2026-10-14", [quote("A", 100, { volume: 10, turnover: 100 })]),
          session("2026-10-15", [quote("A", 110, { volume: 11, turnover: 121 })]),
          session("2026-10-16", []),
        ],
      }),
    );

    expect(market.date).toBe("2026-10-15");
    expect(market.notices).toEqual([{ kind: "empty", date: "2026-10-16" }]);
  });

  it("does not compute a day change across a missing previous session", async () => {
    // 15 October cannot be read. Comparing 16 October with 14 October would show a
    // two-session move and label it one day's change, so the change is withheld instead.
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-16", "2026-10-15", 3),
        sessions: [
          session("2026-10-14", [quote("A", 100, { volume: 10, turnover: 100 })]),
          session("2026-10-16", [quote("A", 110, { volume: 11, turnover: 121 })]),
        ],
      }),
    );

    expect(market.date).toBe("2026-10-16");
    expect(market.previousDate).toBeNull();
    expect(market.rows[0]?.change).toBeNull();
    expect(market.notices).toEqual([{ kind: "previous-unavailable", date: "2026-10-15" }]);
  });

  it("uses an adjacent readable session as the baseline when the date list is unavailable", async () => {
    // The newest file is missing and the archive's date list is unavailable, but 15 October
    // is the calendar day immediately before 16 October and its file reads. There is no day
    // between them for a failed session to hide on, so the change is knowable.
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-17", "2026-10-16", 3),
        sessions: [
          session("2026-10-14", [quote("A", 100)]),
          session("2026-10-15", [quote("A", 110)]),
          session("2026-10-16", [quote("A", 120)]),
        ],
        dateList: false,
      }),
    );

    expect(market.date).toBe("2026-10-16");
    expect(market.previousDate).toBe("2026-10-15");
    expect(market.rows[0]?.change).toBe(10);
    expect(market.notices).toEqual([{ kind: "unavailable", date: "2026-10-17" }]);
  });

  it("does not treat a calendar walk as a list of sessions", async () => {
    // The real client, when sessions.json cannot be read, answers sessionDates() with
    // every calendar day rather than failing. Those weekend days are not missing
    // sessions, so the walk must not report them or stop the baseline at a Sunday.
    // The newest readable session is Monday 19 October; Friday 16 October is the real
    // baseline, but the unverified list withholds the change rather than assert it.
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-20", "2026-10-19", 2),
        sessions: [
          session("2026-10-16", [quote("A", 100, { volume: 10, turnover: 100 })]),
          session("2026-10-19", [quote("A", 110, { volume: 11, turnover: 121 })]),
        ],
        calendarList: true,
      }),
    );

    expect(market.date).toBe("2026-10-19");
    expect(market.previousDate).toBeNull();
    expect(market.rows[0]?.change).toBeNull();
    expect(market.notices).toEqual([
      { kind: "unavailable", date: "2026-10-20" },
      { kind: "session-list-unavailable", date: "2026-10-19" },
    ]);
  });

  it("does not bridge a gap in the sessions-only fallback", async () => {
    // 15 October is unreadable, so the walk sees 14 and 16 as adjacent. It cannot tell
    // whether the fifteenth was a holiday or a session that failed to load, and a day
    // change across the gap would be a two-session move wearing one day's label.
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-17", "2026-10-16", 2),
        sessions: [
          session("2026-10-14", [quote("A", 100, { volume: 10, turnover: 100 })]),
          session("2026-10-16", [quote("A", 110, { volume: 11, turnover: 121 })]),
        ],
        dateList: false,
      }),
    );

    expect(market.date).toBe("2026-10-16");
    expect(market.previousDate).toBeNull();
    expect(market.rows[0]?.change).toBeNull();
    expect(market.notices).toEqual([
      { kind: "unavailable", date: "2026-10-17" },
      { kind: "session-list-unavailable", date: "2026-10-16" },
    ]);
  });

  it("reports when none of the named sessions can be read", async () => {
    await expect(
      loadMarket(
        source({
          manifest: manifest("2026-10-16", "2026-10-15", 2),
          sessions: [],
        }),
      ),
    ).rejects.toMatchObject({ name: "MarketDataError", kind: "no-session" });
  });

  it("reports an empty archive separately from an unreadable one", async () => {
    await expect(
      loadMarket(source({ manifest: manifest(null, null), sessions: [] })),
    ).rejects.toMatchObject({ name: "MarketDataError", kind: "empty" });
  });

  it("says when the archive has not published for too long", async () => {
    const market = await loadMarket(
      source({
        manifest: manifest("2026-10-15", "2026-10-14", 2),
        sessions: [
          session("2026-10-14", [quote("A", 100)]),
          session("2026-10-15", [quote("A", 110)]),
        ],
      }),
      // Fifteen days after the shown session, with nothing newer: the daily job has stopped.
      { now: () => Date.parse("2026-10-30T00:00:00Z") },
    );

    expect(market.notices).toEqual([{ kind: "stale", date: "2026-10-15" }]);
  });
});

describe("describeMarketError", () => {
  it("does not invite a retry when the archive is empty", () => {
    const described = describeMarketError(new MarketDataError("empty", "It holds no sessions."));

    expect(described.retryable).toBe(false);
    expect(described.title).toMatch(/empty/i);
  });

  it("invites a retry when the archive could not be reached", () => {
    expect(describeMarketError(new ArchiveUnavailableError("offline")).retryable).toBe(true);
  });

  it("does not invite a retry for a malformed archive", () => {
    expect(describeMarketError(new ArchiveFormatError("not JSON")).retryable).toBe(false);
  });

  it("does not invite a retry for a date the market did not trade", () => {
    expect(describeMarketError(new SessionNotFoundError("data/daily/x.csv", 404)).retryable).toBe(
      false,
    );
  });
});
