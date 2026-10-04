import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

/** Required under `output: "export"`; see the note in `scripts/make-icons.py`. */
export const dynamic = "force-static";

/**
 * What a browser needs to install the site as an app.
 *
 * ## The icons are files in `public/`, not the generated ones
 *
 * A manifest is read on its own, outside any document, so it needs literal paths. These
 * are the 192 and 512 PNGs the icon script writes, kept next to the favicon so the three
 * sizes are one design. The 512 is offered twice, once as `maskable`: the mark sits inside
 * the safe circle a round Android mask crops to, so the same file can serve both without
 * the N losing an arm.
 *
 * ## The colours cannot follow the theme, and that is the manifest's limit
 *
 * The site swaps its palette on `prefers-color-scheme`, and a manifest has no media query
 * to do the same. One value has to be picked, and it is the light plane: it is what the
 * page is behind a light-setting browser, and it is what the installed window shows before
 * the first paint, so a dark reader gets a brief light splash rather than a light reader
 * getting a flash of black. The `<meta name="theme-color">` in `layout.tsx` does carry the
 * pair, since a meta tag can.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: "NEPSE",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f9f9f7",
    theme_color: "#f9f9f7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
