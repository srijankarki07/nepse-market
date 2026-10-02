/**
 * About the data.
 *
 * Static prose, no fetching, so it is a server component and ships no JavaScript. It
 * exists because this site shows prices and a reader is entitled to know where they came
 * from, what has been done to them, and what has not.
 *
 * It is also where the uncomfortable parts are said plainly rather than left for somebody
 * to discover: the archive is one person's pipeline, the index is derived rather than the
 * exchange's, and the prices are not adjusted.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About this data — NEPSE",
  description:
    "Where these prices come from, what the derived index is, and what the data does not say.",
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8 py-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">About this data</h1>
        <p className="text-[var(--ink-2)]">
          Where the numbers come from, what has been done to them, and what they do not say.
        </p>
      </header>

      <Section title="It is end-of-day only">
        <p>
          Every figure here is a <strong>closing price for a completed session</strong>,
          published roughly an hour after the exchange closes. There is no intraday data
          and no live feed, and there cannot be one from this source — so nothing on this
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
            nepse-data
          </code>{" "}
          npm package reads. This site is a consumer of the package, not a thing apart from
          it.
        </p>
      </Section>

      <Section title="The index is derived, not the exchange's">
        <p>
          The chart on the front page is <strong>not NEPSE&apos;s index</strong>. The
          archive holds prices and volumes, not market capitalisation, so a
          capitalisation-weighted index cannot be reproduced from it — and neither can the
          exchange&apos;s basket definition.
        </p>
        <p>
          What is plotted is an <strong>equal-weighted</strong> index: the average of every
          scrip&apos;s day-on-day price change, chained forward from 100. It answers a real
          question — what would an investor holding every listed scrip in equal amounts
          have earned — and it is labelled as such everywhere it appears. It is not a
          substitute for the exchange&apos;s own index and should not be quoted as one.
        </p>
      </Section>

      <Section title="Prices are not adjusted">
        <p>
          No adjustment is made for bonus shares, rights issues or splits. The source does
          not adjust them and neither does this site, so a long chart shows{" "}
          <strong>nominal prices</strong> — a bonus issue appears as a sudden fall that no
          investor actually experienced. For anything requiring returns over a period
          containing a corporate action, this data needs adjusting first.
        </p>
      </Section>

      <Section title="A missing value is a dash, never a zero">
        <p>
          A scrip that did not trade has no price, and the archive writes an empty field
          rather than a zero. That distinction is carried all the way to the screen: a
          dash means &quot;not published&quot;, and a zero would mean the scrip traded at
          nothing. A day change is shown only when both closes are known — so a newly
          listed scrip shows a dash rather than a rise measured from nothing.
        </p>
      </Section>

      <Section title="Licence">
        <p>
          The code is MIT. <strong>The data is not covered by that licence</strong> — the
          prices are the exchange&apos;s, republished by a third party, and neither this
          site nor the package claims or grants any right over them.
        </p>
      </Section>

      <Section title="What could go wrong">
        <p>
          The archive is one person&apos;s pipeline. If it stops, prices stop arriving —
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-[var(--ink-2)]">{children}</div>
    </section>
  );
}
