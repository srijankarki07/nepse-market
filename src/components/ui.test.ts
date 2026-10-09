/**
 * The primitives' pure parts.
 *
 * The components themselves are not tested here, and deliberately: this repo tests logic,
 * not markup, and a snapshot of a sparkline would assert that two paths look alike rather
 * than that either is right. What is tested is the geometry and the naming, which is where
 * a wrong answer is silent: a sparkline that drew off-canvas or upside down would still
 * render, and an avatar hue in the green range would quietly claim the scrip had risen.
 */

import { describe, expect, it } from "vitest";

import { hueFor, monogramFor, sparkPath } from "./ui";

describe("hueFor", () => {
  it("stays in the cool half of the wheel, clear of the up and down hues", () => {
    // The palette's green sits near 85 degrees and its pink near 10, so anything in the
    // warm half would read as a claim about the scrip rather than as its name.
    const tickers = ["NABIL", "ADBL", "GBILD86/87", "N/A", "A", "ZZZZZZZZZZ"];
    for (const ticker of tickers) {
      const hue = hueFor(ticker);
      expect(hue, ticker).toBeGreaterThanOrEqual(180);
      expect(hue, ticker).toBeLessThan(300);
    }
  });

  it("gives the same ticker the same hue every time", () => {
    // The same scrip has to look the same on the market table and on its own page.
    expect(hueFor("NABIL")).toBe(hueFor("NABIL"));
  });
});

describe("monogramFor", () => {
  it("takes the first two characters of the ticker", () => {
    expect(monogramFor("NABIL")).toBe("NA");
    expect(monogramFor("nabil")).toBe("NA");
    expect(monogramFor("A")).toBe("A");
  });

  it("skips the punctuation a debenture carries", () => {
    expect(monogramFor("GBILD86/87")).toBe("GB");
    expect(monogramFor("NICAD 85/8")).toBe("NI");
  });

  it("falls back to a question mark rather than rendering nothing", () => {
    // An empty circle would look like a broken image rather than a missing ticker.
    expect(monogramFor("///")).toBe("?");
    expect(monogramFor("")).toBe("?");
  });
});

describe("sparkPath", () => {
  it("draws nothing for fewer than two points", () => {
    expect(sparkPath([], 10, 10)).toBe("");
    expect(sparkPath([5], 10, 10)).toBe("");
  });

  it("ignores values that are not numbers", () => {
    expect(sparkPath([1, Number.NaN, 2], 10, 10)).toContain("L");
    expect(sparkPath([1, Number.POSITIVE_INFINITY], 10, 10)).toBe("");
  });

  it("starts with a move and then draws one line per remaining point", () => {
    const path = sparkPath([1, 2, 3, 4], 100, 20);
    expect(path.startsWith("M")).toBe(true);
    expect(path.match(/L/g)).toHaveLength(3);
  });

  it("puts a rise higher on the canvas than a fall", () => {
    // SVG y grows downward, so a rise has to end at a smaller y than it started.
    const y = (path: string, which: "first" | "last") => {
      const pairs = [...path.matchAll(/([\d.]+),([\d.]+)/g)];
      const pair = which === "first" ? pairs[0] : pairs.at(-1);
      return Number(pair?.[2]);
    };

    expect(y(sparkPath([1, 2, 3], 100, 20), "last")).toBeLessThan(y(sparkPath([1, 2, 3], 100, 20), "first"));
    expect(y(sparkPath([3, 2, 1], 100, 20), "last")).toBeGreaterThan(y(sparkPath([3, 2, 1], 100, 20), "first"));
  });

  it("draws a flat series along the middle, not the floor", () => {
    const path = sparkPath([7, 7, 7], 100, 20, 2);
    const ys = [...path.matchAll(/,([\d.]+)/g)].map((match) => Number(match[1]));
    expect(ys.every((value) => Math.abs(value - 10) < 0.001)).toBe(true);
  });

  it("keeps every point inside the box it was given", () => {
    const path = sparkPath([3, 99, 1, 40], 76, 24, 1.5);
    for (const [x, y] of [...path.matchAll(/([\d.]+),([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(76);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(24);
    }
  });
});
