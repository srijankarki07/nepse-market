/**
 * The duplicate-session rule.
 *
 * This is the check that stops a copied session from being presented as a new day. It has
 * to be exact enough to catch a full copy and loose enough not to reject a real, quiet
 * session, so the tests cover both sides of that line.
 */

import { describe, expect, it } from "vitest";
import type { DatedCloses, Quote, Session } from "@srijankarki44/nepse-data";

import { dropRepeatedCloses, isRepeatedSession, sameCloses } from "./repeats";

function quote(symbol: string, close: number, fields: Partial<Quote> = {}): Quote {
  return {
    symbol,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
    turnover: 1_000,
    ...fields,
  };
}

function session(date: string, rows: Quote[]): Session {
  return { date, rows };
}

function closes(date: string, rows: Array<[string, number]>): DatedCloses {
  return { date, closes: new Map(rows) };
}

describe("isRepeatedSession", () => {
  it("recognises a full copy under a second date", () => {
    const before = session("2026-10-15", [quote("A", 100), quote("B", 200)]);
    const copy = session("2026-10-16", [quote("A", 100), quote("B", 200)]);

    expect(isRepeatedSession(copy, before)).toBe(true);
  });

  it("does not care about the order of the rows", () => {
    // The archive sorts by symbol, but a caller should not have to rely on that to get a
    // correct answer.
    const before = session("2026-10-15", [quote("A", 100), quote("B", 200)]);
    const copy = session("2026-10-16", [quote("B", 200), quote("A", 100)]);

    expect(isRepeatedSession(copy, before)).toBe(true);
  });

  it("rejects a session whose volume or turnover moved", () => {
    const before = session("2026-10-15", [quote("A", 100)]);
    const quiet = session("2026-10-16", [
      quote("A", 100, { volume: 101, turnover: 1_010 }),
    ]);

    expect(isRepeatedSession(quiet, before)).toBe(false);
  });

  it("rejects a session that dropped one scrip and gained another", () => {
    const before = session("2026-10-15", [quote("A", 100)]);
    const swapped = session("2026-10-16", [quote("B", 100)]);

    expect(isRepeatedSession(swapped, before)).toBe(false);
  });

  it("never calls an empty session a repeat", () => {
    // An empty file is a broken read, not a copy. The caller reports the two differently.
    const before = session("2026-10-15", [quote("A", 100)]);

    expect(isRepeatedSession(session("2026-10-16", []), before)).toBe(false);
    expect(isRepeatedSession(session("2026-10-16", []), session("2026-10-15", []))).toBe(false);
  });
});

describe("sameCloses", () => {
  it("matches two days with the same closes", () => {
    expect(sameCloses(closes("2026-10-15", [["A", 100]]), closes("2026-10-16", [["A", 100]]))).toBe(
      true,
    );
  });

  it("rejects a day where one close moved", () => {
    expect(
      sameCloses(
        closes("2026-10-15", [
          ["A", 100],
          ["B", 200],
        ]),
        closes("2026-10-16", [
          ["A", 100],
          ["B", 201],
        ]),
      ),
    ).toBe(false);
  });

  it("rejects a day with a different set of scrips", () => {
    expect(sameCloses(closes("2026-10-15", [["A", 100]]), closes("2026-10-16", [["B", 100]]))).toBe(
      false,
    );
  });
});

describe("dropRepeatedCloses", () => {
  it("drops a copy and keeps the session it copied", () => {
    const days = [
      closes("2026-10-14", [["A", 100]]),
      closes("2026-10-15", [["A", 110]]),
      closes("2026-10-16", [["A", 110]]),
    ];

    expect(dropRepeatedCloses(days).map((day) => day.date)).toEqual([
      "2026-10-14",
      "2026-10-15",
    ]);
  });

  it("collapses a run of copies to one", () => {
    // A long closure can leave the source republishing the same session under several
    // dates. Comparing with the last kept day removes all of them.
    const days = [
      closes("2026-10-14", [["A", 100]]),
      closes("2026-10-15", [["A", 110]]),
      closes("2026-10-16", [["A", 110]]),
      closes("2026-10-17", [["A", 110]]),
    ];

    expect(dropRepeatedCloses(days).map((day) => day.date)).toEqual([
      "2026-10-14",
      "2026-10-15",
    ]);
  });

  it("keeps a day whose closes move away and back", () => {
    // Equal to the day before it, not to the last kept day, is not a copy.
    const days = [
      closes("2026-10-14", [["A", 100]]),
      closes("2026-10-15", [["A", 110]]),
      closes("2026-10-16", [["A", 100]]),
    ];

    expect(dropRepeatedCloses(days)).toHaveLength(3);
  });
});
