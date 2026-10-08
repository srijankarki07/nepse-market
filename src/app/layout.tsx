import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Providers } from "./providers";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  openGraphFor,
  twitterFor,
} from "@/lib/site";
import "./globals.css";

/**
 * The shell.
 *
 * ## Colours come from tokens, never from Tailwind's `dark:` variant
 *
 * The whole surface/ink/up/down set is driven by CSS custom properties that swap under
 * `prefers-color-scheme` and under an explicit `data-theme` stamp, see `globals.css`.
 * Writing `dark:bg-neutral-900` here instead would key off Tailwind's own dark variant,
 * which is a *different* mechanism, and the two disagree: the result is a header that
 * stays white in dark mode while everything around it goes black, which is exactly what
 * happened the first time.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The metadata every route inherits.
 *
 * ## The title is a default plus a template, not a string
 *
 * `default` is what a segment with no title of its own gets, which is the home page, so
 * the home title is written once here rather than duplicated in `page.tsx`. `template`
 * then suffixes every *other* page, so `about` only has to say "About this data" and the
 * site name is not repeated in five files.
 *
 * The catch, and the reason the home page sets no title at all: a template applies to
 * child segments, so a home page with its own `title` would render "…market data | NEPSE".
 *
 * ## `metadataBase` is what makes the relative URLs legal
 *
 * Every `url`, `canonical` and image path below is relative. Without `metadataBase` those
 * are a build error, and with it they are resolved to absolute URLs against the one origin
 * in `lib/site.ts`.
 *
 * ## `formatDetection` is not boilerplate here
 *
 * This site is almost entirely numbers, prices, and a phone that decides a run of digits
 * is a telephone number will render it as a blue link. The three detections are off
 * because there is nothing on any page that is an address, an email or a phone number.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "finance",
  keywords: [
    "NEPSE",
    "Nepal Stock Exchange",
    "NEPSE share price",
    "Nepali share market",
    "closing price",
    "end-of-day data",
    "share price history",
    "NEPSE index",
  ],
  authors: [{ name: "Srijan Karki", url: "https://github.com/srijankarki07" }],
  creator: "Srijan Karki",
  publisher: "Srijan Karki",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: openGraphFor({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    path: "/",
  }),
  twitter: twitterFor({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // The figures are the point, so a snippet is capped only by the page itself, and a
      // large image preview is allowed because the share card is a real description of
      // the site rather than a thumbnail of something else.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

/**
 * `themeColor` moved out of `metadata` in Next 14 and belongs here.
 *
 * Two values rather than one, because the site has a light and a dark plane and the
 * browser chrome should sit on whichever the reader is looking at. The pair matches
 * `--plane` in `globals.css`; a mismatch here is a visible seam above the header.
 */
export const viewport: Viewport = {
  colorScheme: "light dark",
  // The browser's own chrome, tinted to match. Re-read from `globals.css` when the palette
  // moves, the same way `make-icons.py` has to be: the dark value here was still the old
  // neutral long after the site went slate-teal, because a `theme-color` is in the address
  // bar and nothing on the page shows it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1418" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The inline script below stamps `data-theme` on this element before React hydrates,
      // from a value the server cannot know. Without this, every reader who has ever chosen
      // a theme gets a hydration mismatch logged on every page load, and React discards and
      // re-renders the root to recover. Suppressing it on `<html>` is the documented remedy
      // for exactly this pattern, and it suppresses the warning for this element only.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Runs before first paint, so a reader who chose dark never sees a white flash.
          It has to be inline and render-blocking: a deferred script would run after the
          browser has already painted the light theme.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("nepse-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}',
          }}
        />
        {/*
          What the site is, for a crawler that reads structured data rather than prose.

          Kept to the claims this site can actually support. There is deliberately no
          `publisher` and no `Organization`: this is one person's pipeline reading a third
          party's archive, and naming an organisation here would invent one.

          `<` is escaped because `JSON.stringify` does not, and an unescaped `<` inside a
          script element is how a string in the data becomes markup on the page.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_NAME,
              alternateName: "Nepal Stock Exchange end-of-day data",
              url: `${SITE_URL}/`,
              description: SITE_DESCRIPTION,
              inLanguage: "en",
            }).replace(/</g, "\\u003c"),
          }}
        />
      </head>

      <body className="flex min-h-full flex-col bg-[var(--plane)] text-[var(--ink)]">
        <header className="border-b border-[var(--hairline)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4 sm:px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              NEPSE
            </Link>
            {/*
              Said plainly and in the header, because it is the single most likely
              misunderstanding about this site: these are closing prices, not a live feed.
              A reader who assumes otherwise reads a stale number as a current one.
            */}
            <span className="text-xs text-[var(--muted)]">
              end-of-day closing prices, not a live feed
            </span>
            <nav className="ml-auto flex items-center gap-4 text-xs text-[var(--ink-2)]">
              <Link href="/" className="hover:underline">
                Market
              </Link>
              <Link href="/about/" className="hover:underline">
                About the data
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          <Providers>{children}</Providers>
        </main>

        <footer className="border-t border-[var(--hairline)] px-4 py-8 text-xs text-[var(--muted)] sm:px-6">
          <div className="mx-auto max-w-6xl space-y-1">
            <p>
              Data from an independent public archive of the exchange&apos;s end-of-day
              figures. Prices are not adjusted for bonus shares, rights or splits.
            </p>
            <p>
              The code is MIT. The data is not covered by that licence.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
