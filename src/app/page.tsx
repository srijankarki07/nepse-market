import type { Metadata } from "next";

import { MarketView } from "./market-view";
import {
  DATASET_NAME,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  openGraphFor,
  twitterFor,
} from "@/lib/site";

/**
 * The home page's server half.
 *
 * It exports the metadata and renders the client view; the queries, the charts and the
 * range buttons are all one level down in `market-view.tsx`. The split is forced by the
 * metadata API being server-only, and it is worth the extra file: it is what gives this
 * route a canonical URL and a share card of its own.
 *
 * No `title` here on purpose. The root layout's `title.default` is already this page's
 * title, and repeating it would run it through the layout's `%s | NEPSE` template twice.
 */
export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: openGraphFor({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    path: "/",
  }),
  twitter: twitterFor({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
};

export default function Home() {
  return (
    <>
      {/*
        The archive described as a dataset.

        This is the half of the site's entity that a reader searching in an answer engine
        actually asks about, and it is stated in the terms the archive can support: what it
        covers, over what period, where, free, and under which licence. `temporalCoverage`
        is left open at the end because the end is today's session and moves.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: DATASET_NAME,
            description: SITE_DESCRIPTION,
            url: `${SITE_URL}/`,
            inLanguage: "en",
            temporalCoverage: "2011/..",
            spatialCoverage: { "@type": "Place", name: "Nepal" },
            isAccessibleForFree: true,
            license: "https://opensource.org/license/mit",
            keywords: [
              "NEPSE",
              "Nepal Stock Exchange",
              "closing price",
              "end-of-day",
              "share market",
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />

      <MarketView />
    </>
  );
}
