"use client";

/**
 * The hero: a few lines of code on one side, and the market they produce on the other.
 *
 * ## Why it is a split rather than a headline
 *
 * This is the npm package's website, so the first thing it has to say is what the package
 * does. A screenshot of a dashboard says "here is a chart"; a code block beside the
 * dashboard it produces says "here is the code that made this", which is the actual
 * claim. The two are animated together — the calls resolve, the figures settle, the rows
 * fill in — so the relationship reads as cause and effect rather than as two pictures
 * placed side by side.
 *
 * ## What is animated, and what is not
 *
 * Only the arrival: the count-up, the row stagger, the line drawing itself. Nothing loops
 * and nothing moves once it has landed, because a hero that keeps moving is a hero that
 * keeps pulling the eye back from the numbers. Everything collapses to the finished state
 * under `prefers-reduced-motion`.
 *
 * ## The numbers are real
 *
 * Every figure here is read from the archive at runtime, not hard-coded for the mockup.
 * A hero that showed invented prices would be a lie told in the most prominent place on
 * the site.
 */

import Link from "next/link";

import { changeColor, count, percent, price, sessionDate, signed } from "@/lib/format";
import type { Market } from "@/lib/market";
import { useCountUp } from "@/hooks/use-count-up";

const INSTALL = "npm install nepse-data";

/** A line of the snippet, split into coloured runs. `tone` is absent on plain text. */
type Token = { readonly text: string; readonly tone?: "kw" | "str" | "cm" };

const SNIPPET: readonly Token[] = [
  { text: "import", tone: "kw" },
  { text: " { createClient } " },
  { text: "from", tone: "kw" },
  { text: ' "nepse-data"', tone: "str" },
  { text: ";\n\n" },
  { text: "const", tone: "kw" },
  { text: " nepse = createClient();\n\n" },
  { text: "const", tone: "kw" },
  { text: " market = " },
  { text: "await", tone: "kw" },
  { text: " nepse.latest();   " },
  { text: "// every scrip", tone: "cm" },
  { text: "\n" },
  { text: "const", tone: "kw" },
  { text: " nabil  = " },
  { text: "await", tone: "kw" },
  { text: " nepse.quote(" },
  { text: '"NABIL"', tone: "str" },
  { text: "); " },
  { text: "// with its change", tone: "cm" },
];

function toneClass(tone: Token["tone"]): string {
  if (tone === "kw") return "text-[var(--code-kw)]";
  if (tone === "str") return "text-[var(--code-str)]";
  if (tone === "cm") return "text-[var(--code-cm)]";
  return "";
}

export function Hero({ market }: { market: Market }) {
  const scrips = useCountUp(market.rows.length);
  const turnover = useCountUp(
    market.rows.reduce((total, row) => total + (row.turnover ?? 0), 0),
    { durationMs: 1100 },
  );

  // The busiest five, which is what a reader scanning a hero wants and what the package
  // returns without a second request — the whole session is already in memory.
  const busiest = [...market.rows]
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, 5);

  return (
    <section className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      <div className="flex flex-col justify-center space-y-5">
        <p className="animate-fade text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          npm · nepse-data
        </p>

        <h1 className="animate-rise text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
          Every NEPSE close since 2011, in a few lines of code.
        </h1>

        <p className="animate-rise max-w-prose text-base text-[var(--ink-2)] [animation-delay:60ms]">
          {count(market.sessionsInArchive)} sessions of end-of-day prices, served from a
          public archive that maintains itself. No API key, no server, no rate limit —
          and no data in the package, so it is current the moment you run it.
        </p>

        <div className="animate-rise flex flex-wrap items-center gap-3 [animation-delay:120ms]">
          <code className="rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 font-mono text-sm">
            {INSTALL}
          </code>
          <Link
            href="/#market"
            className="rounded-md bg-[var(--ink)] px-3 py-2 text-sm font-medium text-[var(--plane)] hover:opacity-90"
          >
            See the market
          </Link>
        </div>

        <pre className="animate-rise overflow-x-auto rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-4 font-mono text-[13px] leading-relaxed [animation-delay:180ms]">
          <code>
            {SNIPPET.map((token, index) => (
              <span key={index} className={toneClass(token.tone)}>
                {token.text}
              </span>
            ))}
          </code>
        </pre>
      </div>

      {/*
        The result panel. It is the same shape a consumer gets back, and it fills in as
        though the code beside it had just run.
      */}
      {/*
        `self-start` so the panel is its own height. Left to stretch it fills the column
        and the leftover becomes a bordered field of nothing under the last row, which
        reads as content that failed to load.
      */}
      <div className="animate-fade flex flex-col gap-3 self-start rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4 [animation-delay:220ms] sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">Session</p>
            <p className="text-sm font-medium">{sessionDate(market.date)}</p>
          </div>
          <p className="text-xs text-[var(--muted)]">equal-weighted · end of day</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--hairline)] p-3">
            <p className="text-xs text-[var(--muted)]">Scrips</p>
            {/* Proportional figures, not tabular: a display-size number set in
                equal-width digits looks loose. */}
            <p className="mt-0.5 text-2xl font-semibold">{Math.round(scrips)}</p>
          </div>
          <div className="rounded-lg border border-[var(--hairline)] p-3">
            <p className="text-xs text-[var(--muted)]">Turnover</p>
            <p className="mt-0.5 text-2xl font-semibold">
              {(turnover / 10_000_000).toFixed(1)}
              <span className="ml-1 text-sm font-normal text-[var(--muted)]">Cr</span>
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--hairline)]">
          <table className="w-full text-sm">
            <caption className="sr-only">
              The five most traded scrips for the {sessionDate(market.date)} session
            </caption>
            <tbody>
              {busiest.map((row, index) => (
                <tr
                  key={row.symbol}
                  className="animate-rise border-b border-[var(--hairline)] last:border-0"
                  style={{ animationDelay: `${300 + index * 70}ms` }}
                >
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.symbol}</span>
                    {row.name !== null && (
                      <span className="block max-w-[14rem] truncate text-xs text-[var(--muted)]">
                        {row.name}
                      </span>
                    )}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{price(row.close)}</td>
                  {/*
                    The sign is always present. Colour is the second channel here, never
                    the only one — which is what lets the green/red pair through, since a
                    reader who cannot separate the hues still reads + and −.
                  */}
                  <td className={`tabular px-3 py-2 text-right ${changeColor(row.change)}`}>
                    {signed(row.change)}
                    <span className="block text-xs opacity-80">{percent(row.changePercent)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Four requests: the index, two sessions, and the ticker directory.
        </p>
      </div>
    </section>
  );
}
