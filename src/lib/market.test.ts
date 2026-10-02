/**
 * The day-change rule.
 *
 * This is the only real rule on the site, and it is the one most easily got wrong in a
 * way nobody notices: a change shown as `0.00` when the baseline is unknown looks exactly
 * like a price that did not move.
 */

import { describe, expect, it } from "vitest";
import type { Quote, Session, SymbolDirectory } from "nepse-data";

import { buildMarket, dayChange, summarise } from "./market";

function quote(symbol: string, close: number | null): Quote {
  return { symbol, open: null, high: null, low: null, close, volume: null, turnover: null };
}

function session(date: string, rows: Quote[]): Session {
  return { date, rows };
}

describe("dayChange", () => {
  it("computes a fall", () => {
    expect(dayChange(566, 570)).toEqual({ change: -4, changePercent: expect.closeTo(-0.7018, 3) });
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
    // The change itself is knowable — 5 from nothing — but a percentage against nothing is
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
    const rows = buildMarket(session("2026-10-01", [quote("NABIL", 566)]), null, directory);

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
      session("2026-09-30", [quote("A", 100), quote("B", 100), quote("C", 100)]),
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
    const rows = buildMarket(session("2026-10-01", [quote("A", 100)]), null, {});

    const summary = summarise(rows);

    expect(summary.unknown).toBe(1);
    expect(summary.unchanged).toBe(0);
  });

  it("treats a missing turnover as zero for the total, which it is", () => {
    // Unlike a price, a missing turnover genuinely contributes nothing to a sum.
    const rows = buildMarket(session("2026-10-01", [quote("A", 100)]), null, {});
    expect(summarise(rows).turnover).toBe(0);
  });
});
