import type { Metadata } from "next";

/**
 * The facts about this site that more than one file has to agree on.
 *
 * ## The origin lives here and nowhere else
 *
 * `metadataBase` turns every relative URL in a metadata object into an absolute one, and
 * `sitemap.ts`, `robots.ts` and the JSON-LD each need the origin independently. Written
 * once, moving to another domain is one edit; hardcoded in five places, it is a hunt for
 * the four that were missed, and the failure is silent, a canonical pointing at a host
 * that does not exist.
 *
 * No trailing slash. `metadataBase` normalises a duplicate against a relative field, but
 * the places that build a URL by hand, `SITE_URL + "/"`, read better without one.
 */
export const SITE_URL = "https://stocks.srijankarki7.com.np";

/** For the tab title, the manifest and `og:site_name`. Short: it appears as a suffix. */
export const SITE_NAME = "NEPSE end-of-day";

/**
 * The one-line version of what this is.
 *
 * The "end-of-day, not a live feed" clause is not decoration and should survive any
 * rewrite: it is the single most likely misunderstanding about the site, and a reader who
 * assumes a live feed reads a stale closing price as a current one.
 */
export const SITE_DESCRIPTION =
  "Closing prices for every scrip on the Nepal Stock Exchange, from 2011 to today, read from a public archive. End-of-day only: there is no live or intraday data here.";

/** The home page's own title, which is also the default for any segment without one. */
export const SITE_TITLE = "NEPSE end-of-day market data";

/** The archive's name in the JSON-LD `Dataset`, where it is a thing rather than a page. */
export const DATASET_NAME = "NEPSE end-of-day closing prices, 2011 to today";

/**
 * The `openGraph` fields every page shares.
 *
 * ## Why this is a function and not a spread
 *
 * Next merges metadata between segments **shallowly**: a page that sets `openGraph` at all
 * replaces the parent's whole `openGraph` object, it does not merge into it. So a page
 * written as `openGraph: { title: "About" }` silently loses `og:site_name`, the locale, the
 * type and the image, and the only symptom is a share card missing half its tags. Building
 * the object from one base keeps all of them on every page.
 *
 * The image is listed here rather than left to the `opengraph-image` file convention for
 * exactly that reason: the convention attaches its image to the segment it sits in, and
 * every nested page here overrides `openGraph`, so only the home page would have had a
 * card. Written into the base, all three do.
 *
 * `path` is relative, resolved against `metadataBase`.
 */
export function openGraphFor({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): NonNullable<Metadata["openGraph"]> {
  return {
    title,
    description,
    url: path,
    siteName: SITE_NAME,
    locale: "en_NP",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME}: closing prices for every scrip on the Nepal Stock Exchange`,
      },
    ],
  };
}

/**
 * The Twitter card, built from the same two strings.
 *
 * No `images` key on purpose. A card with no `twitter:image` falls back to `og:image`,
 * which `openGraphFor` sets on every page, so the card and the open graph image cannot
 * drift apart. Listing the image here as well would only be a second place to keep in step.
 */
export function twitterFor({
  title,
  description,
}: {
  title: string;
  description: string;
}): NonNullable<Metadata["twitter"]> {
  return { card: "summary_large_image", title, description };
}
