import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Providers } from "./providers";
import "./globals.css";

/**
 * The shell.
 *
 * ## Colours come from tokens, never from Tailwind's `dark:` variant
 *
 * The whole surface/ink/up/down set is driven by CSS custom properties that swap under
 * `prefers-color-scheme` and under an explicit `data-theme` stamp — see `globals.css`.
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

export const metadata: Metadata = {
  title: "NEPSE — end-of-day market data",
  description:
    "Closing prices for every scrip on the Nepal Stock Exchange, from 2011 to today, read from a public archive. End-of-day only: there is no live or intraday data here.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
              end-of-day closing prices — not a live feed
            </span>
            <nav className="ml-auto flex gap-4 text-xs text-[var(--ink-2)]">
              <Link href="/" className="hover:underline">
                Market
              </Link>
              <Link href="/about/" className="hover:underline">
                About the data
              </Link>
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
