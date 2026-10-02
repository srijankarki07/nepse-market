/**
 * Formatting, and the one rule that matters in it.
 *
 * Almost all of this is presentation and would be found by looking at the page. The
 * exception is the treatment of `null`, which is not presentation at all: the archive
 * distinguishes "did not trade" from "traded at nothing", the client preserves that
 * distinction as `null`, and a formatter that renders it as `0.00` destroys it at the
 * last step — invisibly, and only for the scrips where it matters.
 */

import { describe, expect, it } from "vitest";

import { changeColor, count, direction, percent, price, sessionDate, signed, turnover, volume } from "./format";

describe("an absent value is a dash", () => {
  it("never renders null as a number", () => {
    for (const render of [price, signed, percent, volume, turnover, count]) {
      expect(render(null)).toBe("—");
      expect(render(undefined)).toBe("—");
    }
  });

  it("does not render null as a zero either", () => {
    // `0.00` is the failure that looks like success: it is a well-formed number making a
    // claim the source did not make.
    expect(price(null)).not.toBe("0.00");
    expect(volume(null)).not.toBe("0");
  });
});

describe("price and count", () => {
  it("groups and always shows two decimals", () => {
    expect(price(2739.9)).toBe("2,739.90");
    expect(price(870)).toBe("870.00");
  });

  it("keeps a genuine zero", () => {
    expect(price(0)).toBe("0.00");
  });
});

describe("signed and percent", () => {
  it("makes a rise and a fall read alike", () => {
    expect(signed(4.5)).toBe("+4.50");
    expect(signed(-4.5)).toBe("−4.50");
  });

  it("reports zero without a sign", () => {
    // A plus on a zero would read as a small rise.
    expect(signed(0)).toBe("0.00");
    expect(percent(0)).toBe("0.00%");
  });

  it("signs percentages", () => {
    expect(percent(6.06)).toBe("+6.06%");
    expect(percent(-3.99)).toBe("−3.99%");
  });
});

describe("turnover and volume", () => {
  it("abbreviates in lakh and crore, as the figures are discussed locally", () => {
    expect(turnover(489_190_000)).toBe("48.92 Cr");
    expect(turnover(2_500_000)).toBe("25.00 L");
  });

  it("leaves a small figure alone", () => {
    expect(turnover(45_000)).toBe("45,000");
  });

  it("abbreviates volume more coarsely", () => {
    expect(volume(667_000)).toBe("6.67 L");
    expect(volume(54_400)).toBe("54.4 K");
    expect(volume(420)).toBe("420");
  });
});

describe("sessionDate", () => {
  it("renders a session date as a readable one", () => {
    expect(sessionDate("2026-10-01")).toBe("1 Oct 2026");
  });

  it("does not shift the date under a reader's timezone", () => {
    // Parsed and rendered in UTC. A local-time parse would show 30 September to anyone
    // west of Kathmandu, which is the classic way an end-of-day date is off by one.
    expect(sessionDate("2026-01-01")).toBe("1 Jan 2026");
    expect(sessionDate("2026-12-31")).toBe("31 Dec 2026");
  });

  it("passes through something that is not a date", () => {
    expect(sessionDate("not a date")).toBe("not a date");
  });
});

describe("direction and colour", () => {
  it("treats an unknown change as neither up nor down", () => {
    // Not "flat" — a colour is a claim, and there is nothing to claim.
    expect(direction(null)).toBe("flat");
    expect(direction(0)).toBe("flat");
    expect(direction(1)).toBe("up");
    expect(direction(-1)).toBe("down");
  });

  it("does not colour a dash as a fall", () => {
    // Red on "—" would read as a loss.
    expect(changeColor(null)).toBe(changeColor(0));
  });
});
