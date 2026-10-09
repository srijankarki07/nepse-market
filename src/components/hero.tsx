"use client";

/**
 * The hero: what the package is, and the package running.
 *
 * ## Why a terminal rather than a snippet beside a chart
 *
 * This is the npm package's website, so the first thing it has to say is what the package
 * does. The previous hero put a code block next to a dashboard and left the reader to
 * connect them. A terminal does it as a sequence: the command goes in, the numbers come
 * out, and the connection is the whole point rather than an inference.
 *
 * The dashboard has not gone anywhere. It is the entire rest of the page, which is a more
 * convincing demonstration of what the package returns than a preview panel was.
 *
 * ## The figures are read from the archive, never written here
 *
 * Date, scrip count and the featured quote all come from the session the page is already
 * showing. A hero that printed invented prices would be a lie told in the most prominent
 * place on the site, which is the one thing this page cannot afford.
 */

import { useMemo, useState } from "react";
import Link from "next/link";

import { Terminal, type TerminalLine, type TerminalSpan } from "@/components/terminal";
import { ArrowUpRight, Grid, Layers, TrendUp } from "@/components/icons";
import { count, percent, price, sessionDate, signed, turnover } from "@/lib/format";
import type { Market } from "@/lib/market";
import { useCountUp } from "@/hooks/use-count-up";

const PACKAGE = "@srijankarki44/nepse-data";
const INSTALL = `npm install ${PACKAGE}`;
const REPO = "https://github.com/srijankarki07/nepse-data";
const NPM = `https://www.npmjs.com/package/${PACKAGE}`;

/*
 * The transcript's vocabulary, as six one-word constructors.
 *
 * Without them the transcript below is a wall of `{ text, tone }` objects and stops being
 * readable as the thing it is describing, which defeats the point of showing it at all.
 * These name the *reason* for a colour rather than the colour: `kw` is a keyword, `pkg` is
 * one of the names this site cares about.
 */
const pkg = (text: string): TerminalSpan => ({ text, tone: "pkg" });
const kw = (text: string): TerminalSpan => ({ text, tone: "key" });
const fn = (text: string): TerminalSpan => ({ text, tone: "fn" });
const str = (text: string): TerminalSpan => ({ text, tone: "str" });
const num = (text: string): TerminalSpan => ({ text, tone: "num" });
const dim = (text: string): TerminalSpan => ({ text, tone: "dim" });

/** Runs of a line, letting the plain stretches be written as plain strings. */
function code(...parts: readonly (string | TerminalSpan)[]): TerminalSpan[] {
  return parts.map((part) => (typeof part === "string" ? { text: part } : part));
}

/** `key: value,` with each half in its own colour. `last` drops the trailing comma. */
function pair(key: string, value: TerminalSpan, last = false): TerminalSpan[] {
  return [kw(key), dim(": "), value, dim(last ? " " : ", ")];
}

/** A one-line rendition of an object, the way a REPL prints one. */
function print(pairs: readonly TerminalSpan[][]): TerminalSpan[] {
  return [dim("{ "), ...pairs.flat(), dim("}")];
}

/**
 * The transcript, built from the session on screen.
 *
 * Every value is real, and the symbol is NABIL when it traded and the busiest scrip when it
 * did not, so the demo cannot print an empty row for a company that happens to be suspended
 * on the day someone visits.
 *
 * ## The shape is a real session, not a script
 *
 * `npm install` is a shell command and gets a `$`; everything after it is a Node expression
 * and gets the REPL's `>`. A transcript that answered a `$` with a JavaScript expression
 * would read as wrong to the audience this is written for, which is the one thing a device
 * like this cannot afford.
 *
 * The REPL's echo of an assignment is skipped rather than faked. `const x = ...` really does
 * print `undefined` in Node, and printing it here would be honest but would spend two of the
 * window's lines saying nothing.
 */
function transcriptFor(market: Market): TerminalLine[] {
  const featured =
    market.rows.find((row) => row.symbol === "NABIL") ??
    [...market.rows].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))[0];

  const totalTurnover = market.rows.reduce((total, row) => total + (row.turnover ?? 0), 0);

  const lines: TerminalLine[] = [
    { kind: "command", text: code(pkg("npm"), dim(" install "), str(PACKAGE)) },
    { kind: "output", text: code(dim("added "), num("1"), dim(" package, and no market data")) },
    { kind: "blank" },
    // `npm` and `node` are `pkg` rather than `fn`: they are the names a reader came here to
    // find, which is what the accent means everywhere else on this site.
    { kind: "command", text: code(pkg("node")), prompt: "$" },
    {
      kind: "command",
      prompt: ">",
      text: code(kw("const"), " market = ", kw("await"), " nepse.", fn("latest"), "()"),
    },
    {
      kind: "output",
      text: print([
        pair("date", str(`"${market.date}"`)),
        pair("scrips", num(String(market.rows.length))),
        pair("turnover", str(`"${turnover(totalTurnover)}"`), true),
      ]),
    },
    { kind: "blank" },
  ];

  if (featured !== undefined) {
    const local = featured.symbol.toLowerCase();

    lines.push(
      {
        kind: "command",
        prompt: ">",
        text: code(kw("const"), ` ${local} = `, kw("await"), " nepse.", fn("quote"), "(", str(`"${featured.symbol}"`), ")"),
      },
      {
        kind: "output",
        text: print([
          pair("close", num(price(featured.close))),
          pair("change", num(signed(featured.change))),
          pair("changePercent", num(percent(featured.changePercent)), true),
        ]),
      },
      { kind: "blank" },
    );
  }

  lines.push({
    kind: "command",
    prompt: ">",
    text: code("nepse.", fn("manifest"), "()"),
  });
  lines.push({
    kind: "output",
    text: print([
      pair("latest", str(`"${market.date}"`)),
      pair("sessions", num(count(market.sessionsInArchive)), true),
    ]),
  });

  return lines;
}

/** The install line, with a copy button. The one thing a reader came to the hero to take. */
function InstallLine() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // A blocked clipboard is not worth an error: the command is right there to select.
    }
  }

  return (
    <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] py-2 pr-2 pl-3 text-left">
      <code className="min-w-0 flex-1 truncate font-mono text-[13px]">
        <span aria-hidden="true" className="text-[var(--muted)] select-none">
          ${" "}
        </span>
        {INSTALL}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-[var(--hairline)] px-2.5 py-1 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--ink)]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function Hero({ market }: { market: Market }) {
  const scrips = useCountUp(market.rows.length);
  const totalTurnover = useCountUp(
    market.rows.reduce((total, row) => total + (row.turnover ?? 0), 0),
    { durationMs: 1100 },
  );

  /*
   * Held steady for the life of a session rather than rebuilt on every render. `Terminal`
   * memoises its timings on this array, so a new one each render would restart the whole
   * animation every time anything on the page re-rendered, including the two count-ups.
   */
  const transcript = useMemo(() => transcriptFor(market), [market]);

  return (
    <section className="hero-wash flex flex-col items-center gap-10">
      {/*
        `min-w-0` is load-bearing. A flex child defaults to `min-width: auto`, which means it
        refuses to shrink below its content, and the terminal below is content that does not
        wrap. Without this the whole page scrolls sideways on a phone.
      */}
      <div className="flex min-w-0 max-w-3xl flex-col items-center space-y-6 text-center">
        {/*
          The eyebrow as a pill with a status dot, which is the shape the references use for
          "what this is" and reads as a label rather than as the start of a sentence. The dot
          is the up-green: this site is running and current, which is the one claim the pill
          is making.
        */}
        <p className="animate-fade inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--up)]" />
          npm · {PACKAGE}
        </p>

        <h1 className="animate-rise text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Every NEPSE close since 2011, in a few lines of code.
        </h1>

        <p className="animate-rise max-w-prose text-base text-[var(--ink-2)] [animation-delay:60ms]">
          {count(market.sessionsInArchive)} sessions of end-of-day prices, served from a public
          archive that maintains itself. No API key, no server, no rate limit, and no data in the
          package, so it is current the moment you run it.
        </p>

        <div className="animate-rise flex w-full flex-col items-center gap-3 [animation-delay:120ms]">
          <InstallLine />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="#market"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--plane)] transition-opacity hover:opacity-90"
            >
              See the market
            </Link>
            {[
              { href: NPM, label: "npm" },
              { href: REPO, label: "GitHub" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--ink)]"
              >
                {link.label}
                <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
        </div>

        {/*
          The three figures, the way the references end a hero: a rule, then the numbers at
          display size with small captions under them. Read as a band of evidence for the
          claim in the headline rather than as three more paragraphs.
        */}
        <dl className="animate-fade grid w-full grid-cols-3 gap-4 border-t border-[var(--hairline)] pt-6 [animation-delay:200ms]">
          {[
            { icon: <Grid size={14} />, label: "Scrips traded", value: count(scrips) },
            { icon: <TrendUp size={14} />, label: "Turnover", value: `${turnover(totalTurnover)}` },
            {
              icon: <Layers size={14} />,
              label: "Session",
              value: sessionDate(market.date),
            },
          ].map((stat) => (
            <div key={stat.label}>
              <dd className="tabular text-2xl font-semibold tracking-tight">{stat.value}</dd>
              <dt className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[var(--muted)]">
                {stat.icon}
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      {/*
        Below the copy rather than beside it, which is the change this hero wanted. Side by
        side, both columns were cramped: the headline had to break early and the terminal
        had to wrap the very lines that are supposed to look like a real session. Stacked,
        the transcript gets the page's full width and its lines stay one line each, which is
        what makes it read as a terminal rather than as wrapped prose.
      */}
      <Terminal
        className="animate-fade w-full min-w-0 max-w-3xl [animation-delay:180ms]"
        title={`${PACKAGE} — node`}
        lines={transcript}
      />
    </section>
  );
}
