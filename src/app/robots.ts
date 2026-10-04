import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/** Required under `output: "export"`; see the note in `opengraph-image.tsx`. */
export const dynamic = "force-static";

/**
 * Everything is crawlable.
 *
 * There is nothing here to hide: no accounts, no drafts, no admin, and the only URLs that
 * are not worth indexing, the bare `/symbol/` and its `?t=` variants, are handled with a
 * page-level canonical rather than a robots rule. Disallowing a URL that is linked from
 * the site is the worse trade, because a crawler that is blocked from fetching it can
 * still see the link and has no way to learn the page says nothing.
 *
 * `host` is a Yandex directive and harmless elsewhere; `sitemap` is the one line here that
 * a crawler actually needs.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
