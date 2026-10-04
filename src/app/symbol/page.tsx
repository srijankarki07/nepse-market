import type { Metadata } from "next";
import { Suspense } from "react";

import { SymbolView } from "./symbol-view";
import { openGraphFor, twitterFor } from "@/lib/site";

/**
 * One scrip's server half.
 *
 * The page is a single HTML file serving every listed scrip, reached as `?t=NABIL`, so
 * there is no symbol here to write tags about: a static export has no per-request server,
 * and `searchParams` on a prerendered page are always empty.
 *
 * ## Why there is no `alternates.canonical`
 *
 * Deliberately absent, and the one page on the site where that is the right answer. A
 * canonical of `/symbol/` would tell a search engine that NABIL, NABIL's neighbours and
 * the other 351 scrips are all the same page, and only the generic one would be indexed.
 * Omitting it leaves each `?t=` URL self-canonical, which is what they are: distinct
 * content that happens to be rendered by one file. `symbol-view.tsx` sets the canonical
 * per scrip on the client, which is where the symbol is actually known.
 *
 * ## Why this is indexable rather than `noindex`
 *
 * Every scrip is linked from the market table, so these URLs are discoverable, and they
 * are the only pages here with a chance of answering "NABIL share price". The title is
 * generic until the client rewrites it, which is a real limit of the architecture, but a
 * generic title is better than no page at all.
 */
export const metadata: Metadata = {
  title: "Scrip price history",
  description:
    "Closing price, day change and session history for a single scrip on the Nepal Stock Exchange, from the end-of-day archive. Not a live quote.",
  openGraph: openGraphFor({
    title: "Scrip price history",
    description:
      "Closing price, day change and session history for a single scrip on the Nepal Stock Exchange, from the end-of-day archive.",
    path: "/symbol/",
  }),
  twitter: twitterFor({
    title: "Scrip price history",
    description:
      "Closing price, day change and session history for a single scrip on the Nepal Stock Exchange, from the end-of-day archive.",
  }),
};

export default function SymbolPage() {
  // `useSearchParams` needs a boundary to prerender, which a static export does at build.
  return (
    <Suspense fallback={<p className="text-sm text-[var(--ink-2)]">Loading…</p>}>
      <SymbolView />
    </Suspense>
  );
}
