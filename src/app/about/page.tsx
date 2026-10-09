/**
 * About the data.
 *
 * Static prose, no fetching, so it is a server component and ships no JavaScript. It
 * exists because this site shows prices and a reader is entitled to know where they came
 * from, what has been done to them, and what has not.
 *
 * It is also where the uncomfortable parts are said plainly rather than left for somebody
 * to discover: the archive is one person's pipeline, the equal-weighted index is derived
 * rather than the exchange's, and the prices are not adjusted.
 *
 * ## The page carries two indices, and the difference is a whole section
 *
 * It used to carry one, and the section explaining it was three sentences. Since the
 * exchange's own levels arrived there are two things on this site that a reader could
 * reasonably call "the index", they are not interchangeable, and they are on the same
 * screen. So the section compares them in a table rather than describing one and leaving
 * the other to be inferred.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { openGraphFor, twitterFor } from "@/lib/site";

/**
 * The title has no site name on the end: the root layout's `%s | NEPSE end-of-day`
 * template adds it, and writing it here as well would produce it twice.
 */
const TITLE = "About this data";
const DESCRIPTION =
  "Where these prices come from, what the two indices are, and what the data does not say.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about/" },
  openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: "/about/" }),
  twitter: twitterFor({ title: TITLE, description: DESCRIPTION }),
};

/**
 * The two things this site calls an index, asked the same five questions.
 *
 * Two lists of pairs rather than one list of three-column rows, because the two panels
 * stack on a phone: a three-column table here would either scroll sideways, which this
 * site avoids on purpose, or crush the column that carries the actual explanation.
 */
const COMPUTED_ROWS = [
  ["What it is", "The mean of every scrip's day-on-day change, chained forward from 100."],
  ["Where it comes from", "Arithmetic done on this site, from the archive's closing prices."],
  ["Is it NEPSE's?", "No. A different measure that happens to be drawn the same way."],
  ["How far back", "Every session in the archive, to 2011."],
  ["Where you see it", "The chart under Market pulse."],
] as const;

const EXCHANGE_ROWS = [
  [
    "What it is",
    "One of the exchange's published levels, weighted by market capitalisation.",
  ],
  [
    "Where it comes from",
    "Read from the exchange and republished by the archive. Not computed here.",
  ],
  ["Is it NEPSE's?", "Yes. These are the exchange's own figures."],
  ["How far back", "From October 2026, when the archive began recording them."],
  ["Where you see it", "The Major indices grid."],
] as const;

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-10 py-4">
      <header className="space-y-3">
        <p className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
          About
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">About this data</h1>
        <p className="text-[var(--ink-2)]">
          Where the numbers come from, what has been done to them, and what they do not say.
        </p>
      </header>

      <Section title="It is end-of-day only">
        <p>
          Every figure here is a <strong>closing price for a completed session</strong>,
          published roughly an hour after the exchange closes. There is no intraday data
          and no live feed, and there cannot be one from this source, so nothing on this
          site is a current price. The date on every page is the session the archive holds,
          never today&apos;s date.
        </p>
      </Section>

      <Section title="Where it comes from">
        <p>
          The exchange&apos;s own API sits behind a token it generates in WebAssembly,
          which a scheduled job cannot reasonably obtain. So the data is scraped from
          ShareSansar, which republishes the exchange&apos;s end-of-day figures, by{" "}
          <a
            className="underline"
            href="https://github.com/srijankarki07/nepse-data"
            target="_blank"
            rel="noreferrer"
          >
            a separate repository
          </a>{" "}
          that runs once a day and commits one CSV per session. It has done so since
          October 2026 and holds every session back to 2011.
        </p>
        <p>
          That repository is also what the{" "}
          <code className="rounded border border-[var(--hairline)] px-1 py-0.5 font-mono text-sm">
            @srijankarki44/nepse-data
          </code>{" "}
          npm package reads. This site is a consumer of the package, not a thing apart from
          it.
        </p>
      </Section>

      <Section title="There are two indices here, and they are not the same thing">
        <p>
          Both are called &ldquo;the index&rdquo; by somebody, they appear within a screen of
          each other, and confusing them is the easiest mistake to make on this site. So:
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <IndexPanel
            title="Equal-weighted"
            note="computed on this site"
            accent="var(--accent)"
            rows={COMPUTED_ROWS}
          />
          <IndexPanel
            title="The exchange's"
            note="published by NEPSE"
            accent="var(--seq-5)"
            rows={EXCHANGE_ROWS}
          />
        </div>

        <p>
          <strong>Equal-weighted</strong> means every listed scrip counts the same, so the
          figure answers a real question: what would an investor holding every scrip in
          equal amounts have earned? NEPSE&apos;s indices weight by market capitalisation
          instead, so a large bank moves them more than a small one. That needs share
          counts, and the archive holds prices and volumes only, so the exchange&apos;s
          arithmetic <strong>cannot be reproduced from this data</strong>.
        </p>
        <p>
          The exchange&apos;s levels are therefore <strong>read rather than derived</strong>,
          which is why they begin in October 2026 rather than in 2011: the archive can walk
          its price history backwards and rebuild it, but the source only ever shows the
          current session&apos;s index levels, so they could only be accumulated from the
          day that began. Wherever either index appears it is labelled, and the
          equal-weighted one should not be quoted as NEPSE&apos;s.
        </p>
      </Section>

      <Section title="Prices are not adjusted">
        <p>
          No adjustment is made for bonus shares, rights issues or splits. The source does
          not adjust them and neither does this site, so a long chart shows{" "}
          <strong>nominal prices</strong>. A bonus issue appears as a sudden fall that no
          investor actually experienced. For anything requiring returns over a period
          containing a corporate action, this data needs adjusting first.
        </p>
      </Section>

      <Section title="A missing value is a dash, never a zero">
        <p>
          A scrip that did not trade has no price, and the archive writes an empty field
          rather than a zero. That distinction is carried all the way to the screen: a
          dash means &quot;not published&quot;, and a zero would mean the scrip traded at
          nothing. A day change is shown only when both closes are known, so a newly
          listed scrip shows a dash rather than a rise measured from nothing.
        </p>
      </Section>

      <Section title="Licence">
        <p>
          The code is MIT. <strong>The data is not covered by that licence</strong>. The
          prices are the exchange&apos;s, republished by a third party, and neither this
          site nor the package claims or grants any right over them.
        </p>
      </Section>

      <Section title="What could go wrong">
        <p>
          The archive is one person&apos;s pipeline. If it stops, prices stop arriving:
          the failure is visible here as sessions that simply stop advancing, and the
          archive is designed to fail loudly rather than write a bad file. The history
          before 2011 is not attempted, and the source&apos;s coverage is patchy in its
          earliest years.
        </p>
      </Section>

      <footer className="border-t border-[var(--hairline)] pt-6">
        <Link href="/" className="text-sm underline">
          Back to the market
        </Link>
      </footer>
    </article>
  );
}

/**
 * One of the two indices, as a panel of the same five questions.
 *
 * The accent rule is the card language this site uses everywhere else, and the two panels
 * carry different colours on purpose: `--accent` for the thing this site computes, the
 * sequential blue for the thing it merely republishes. That keeps the two distinguishable
 * by a second channel, the same way a gain and a loss are.
 */
function IndexPanel({
  title,
  note,
  accent,
  rows,
}: {
  title: string;
  note: string;
  accent: string;
  rows: readonly (readonly [string, string])[];
}) {
  return (
    <section className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <header className="flex flex-wrap items-baseline gap-2.5">
        <span
          aria-hidden
          className="h-3.5 w-1 shrink-0 self-center rounded-full"
          style={{ background: accent }}
        />
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-[var(--muted)]">{note}</span>
      </header>

      <dl className="mt-4 space-y-3">
        {rows.map(([aspect, answer]) => (
          <div key={aspect}>
            <dt className="text-xs text-[var(--muted)]">{aspect}</dt>
            <dd className="mt-0.5 leading-relaxed">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * A titled block of prose.
 *
 * The heading carries the same short accent rule the cards use, and the body is indented
 * to the rule's width, so a section here reads as the same kind of object as a card on the
 * market page rather than as a separate document style. That is the whole of the restyle:
 * the prose is unchanged, and what moved is that the page now speaks the site's language.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2.5 text-lg font-semibold tracking-tight">
        <span
          aria-hidden
          className="h-3.5 w-1 shrink-0 self-center rounded-full bg-[var(--accent)]"
        />
        {title}
      </h2>
      <div className="space-y-3 pl-3.5 text-sm leading-relaxed text-[var(--ink-2)]">
        {children}
      </div>
    </section>
  );
}
