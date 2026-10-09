"use client";

/**
 * The header's links, with the page you are on marked.
 *
 * ## Why this is a client component and the header around it is not
 *
 * `usePathname` is the only thing here that needs the router, and it buys two things a
 * server-rendered nav cannot have: `aria-current="page"` for a screen reader, and a filled
 * pill so a sighted reader can see which of two destinations they are standing on. The
 * layout, the wordmark and the claim beside it all stay on the server.
 *
 * Safe under `output: "export"`. The one documented way this hook misbehaves is a rewrite or
 * a proxy making the browser's pathname differ from the one the server prerendered, and this
 * app has neither — `next.config.ts` sets only `output` and `trailingSlash`.
 *
 * ## `/symbol/` counts as the market
 *
 * A scrip page is reached by choosing a scrip, never from here, so it is not a third nav
 * item: it is somewhere `Market` led you to, and marking `Market` while you are on it is the
 * truthful answer to "where am I".
 *
 * `startsWith` rather than equality because the app is exported with `trailingSlash`, so a
 * route arrives as `/about/` and comparing against `/about` would never match.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "./theme-toggle";

/**
 * `short` is what a phone shows.
 *
 * Only `About the data` has one. At 390px the header is one row holding the brand, the claim
 * that these are closing prices rather than a live feed, both links and the theme button, and
 * that claim is 23px short of fitting. Shortening this label is what pays for it — the claim
 * appears nowhere else on the page, and an `About` link on a site with one other top-level
 * destination is not ambiguous.
 */
const LINKS = [
  {
    href: "/",
    label: "Market",
    short: "Market",
    here: (path: string) => path === "/" || path.startsWith("/symbol"),
  },
  {
    href: "/about/",
    label: "About the data",
    short: "About",
    here: (path: string) => path.startsWith("/about"),
  },
] as const;

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <div className="ml-auto flex items-center gap-1">
      <nav aria-label="Main" className="flex items-center gap-0.5">
        {LINKS.map((link) => {
          const here = link.here(pathname);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={here ? "page" : undefined}
              // The fill is the site's one hover idiom, borrowed from `Segmented` and the
              // theme toggle. Being on the page is the same fill held rather than hovered,
              // and `--ink` against `--ink-2` carries the difference for anyone who never
              // hovers. The accent stays out of it: it means "you can touch this", and a
              // location is not an action.
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                here
                  ? "bg-[var(--grid)] text-[var(--ink)]"
                  : "text-[var(--ink-2)] hover:bg-[var(--grid)] hover:text-[var(--ink)]"
              }`}
            >
              {/* Both are in the markup and CSS picks one, so the wider label is never
                  briefly painted on a phone. `display: none` also keeps the hidden one out
                  of the accessibility tree, so the link is named once either way. */}
              <span className="sm:hidden">{link.short}</span>
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <ThemeToggle />
    </div>
  );
}
