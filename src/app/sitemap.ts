import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/** Required under `output: "export"`; see the note in `opengraph-image.tsx`. */
export const dynamic = "force-static";

/**
 * Two URLs, and that is the whole sitemap.
 *
 * ## Why the scrips are not listed
 *
 * Every listed scrip has a page, but they are all `/symbol/?t=…`, and there are 353 of
 * them behind one file. Listing them here would mean the build fetching the ticker
 * directory, which would make the build depend on the archive being reachable and would
 * 404 nothing useful when it is not. It would also be a list that goes stale the moment a
 * company lists. They are linked from the market table instead, which is how a crawler
 * finds them, and how a reader does.
 *
 * `/symbol/` itself is left out for the same reason it is left out of the index rules: on
 * its own, with no `?t=`, it is a page that says no scrip was named.
 *
 * ## `lastModified` is the deploy, not the session
 *
 * The archive advances daily but these two pages are prose and a shell that do not, and
 * the build has no session date to hand. A date that moved with the data would teach a
 * crawler to recrawl a changelog that never changed.
 */
export default function sitemap(): MetadataRoute.Sitemap {  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about/`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
