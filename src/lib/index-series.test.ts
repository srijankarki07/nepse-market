/**
 * The derived index.
 *
 * It is the only number on this site that the archive does not publish, so it is the one
 * most worth pinning down: if it is wrong, nothing upstream disagrees with it.
 */

import { describe, expect, it } from "vitest";
import type { Quote, Session } from "nepse-data";

import { computeMarketIndex, indexExtremes, meanRatio } from "./index-series";

function q(symbol: string, close: number | null): Quote {
  return { symbol, open: null, high: null, low: null, close, volume: null, turnover: null };
}

function s(date: string, rows: Array<[string, number | null]>): Session {
  return { date, rows: rows.map(([symbol, close]) => q(symbol, close)) };
}

describe("meanRatio", () => {
  it("averages each scrip's own ratio, not the price level", () => {
    // A ratio-of-means would weight the 1,000 stock twenty times the 50 stock by price,
    // which is the opposite of equal-weighted.
    const ratio = meanRatio(s("2026-01-01", [["A", 100], ["B", 50]]), s("2026-01-02", [["A", 110], ["B", 60]]));

    // (1.10 + 1.20) / 2, not (110 + 60) / (100 + 50)
    expect(ratio).toBeCloseTo(1.15, 6);
  });

  it("ignores a scrip that is missing from either side", () => {
    const ratio = meanRatio(
      s("2026-01-01", [["A", 100], ["GONE", 10]]),
      s("2026-01-02", [["A", 110], ["NEW", 10]]),
    );

    expect(ratio).toBeCloseTo(1.1, 6);
  });

  it("ignores a scrip with no close on either side", () => {
    const ratio = meanRatio(
      s("2026-01-01", [["A", 100], ["HALTED", null]]),
      s("2026-01-02", [["A", 110], ["HALTED", 50]]),
    );

    expect(ratio).toBeCloseTo(1.1, 6);
  });

  it("refuses to divide by a zero previous close", () => {
    // Infinity here would poison every point after it, and the chart would be blank.
    const ratio = meanRatio(s("2026-01-01", [["A", 0], ["B", 100]]), s("2026-01-02", [["A", 50], ["B", 110]]));

    expect(ratio).toBeCloseTo(1.1, 6);
  });

  it("has no ratio when the two sessions share nothing", () => {
    expect(meanRatio(s("2026-01-01", [["A", 100]]), s("2026-01-02", [["B", 100]]))).toBeNull();
  });
});

describe("computeMarketIndex", () => {
  const flat = s("2026-01-01", [["A", 100], ["B", 200]]);

  it("starts at 100", () => {
    const index = computeMarketIndex([flat]);
    expect(index.points).toEqual([{ date: "2026-01-01", value: 100, constituents: 2 }]);
  });

  it("chains the daily ratio forward", () => {
    const index = computeMarketIndex([
      flat,
      s("2026-01-02", [["A", 110], ["B", 220]]), // both +10%
      s("2026-01-03", [["A", 121], ["B", 220]]), // A +10%, B flat -> +5%
    ]);

    expect(index.points.map((p) => p.value)).toEqual([100, 110, 115.5]);
    expect(index.changePercent).toBeCloseTo(15.5, 4);
  });

  it("sorts the sessions it is given", () => {
    // The caller fetches a range; nothing guarantees it arrives ascending.
    const index = computeMarketIndex([
      s("2026-01-02", [["A", 110]]),
      s("2026-01-01", [["A", 100]]),
    ]);

    expect(index.points.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-02"]);
    expect(index.points[1]?.value).toBeCloseTo(110, 4);
  });

  it("skips a day the two sessions share nothing, rather than plotting it flat", () => {
    // A market that was shut is not a day of zero return. Carrying the level across would
    // draw a false plateau and drag every subsequent reading.
    const index = computeMarketIndex([
      flat,
      s("2026-01-02", [["C", 10]]),
      s("2026-01-03", [["A", 110], ["B", 200]]),
    ]);

    expect(index.points.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-03"]);
    expect(index.points.at(-1)?.value).toBeCloseTo(105, 4);
  });

  it("reports no change for a single session", () => {
    // Not zero, there is nothing to have changed from.
    expect(computeMarketIndex([flat]).changePercent).toBeNull();
  });

  it("reports no change for no sessions", () => {
    expect(computeMarketIndex([])).toEqual({ points: [], changePercent: null });
  });
});

describe("indexExtremes", () => {
  it("finds the high and low points", () => {
    const index = computeMarketIndex([
      s("2026-01-01", [["A", 100]]),
      s("2026-01-02", [["A", 120]]),
      s("2026-01-03", [["A", 90]]),
    ]);

    const { high, low } = indexExtremes(index);

    expect(high?.date).toBe("2026-01-02");
    expect(low?.date).toBe("2026-01-03");
  });
});
