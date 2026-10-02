import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Providers } from "./providers";
import "./globals.css";

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
    "Closing prices for every scrip on the Nepal Stock Exchange, from 2011 to today. End-of-day only: there is no live or intraday data here.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-7xl items-baseline gap-4 px-4 py-4 sm:px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              NEPSE
            </Link>
            {/*
              Said plainly and in the header, because it is the single most likely
              misunderstanding about this site: it shows closing prices, not a live feed.
              A reader who assumes otherwise will read a stale number as a current one.
            */}
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              end-of-day closing prices — not a live feed
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Providers>{children}</Providers>
        </main>

        <footer className="border-t border-neutral-200 px-4 py-6 text-xs text-neutral-500 sm:px-6 dark:border-neutral-800 dark:text-neutral-400">
          <div className="mx-auto max-w-7xl space-y-1">
            <p>
              Data from an independent public archive of the exchange&apos;s end-of-day
              figures. Prices are not adjusted for bonus shares, rights or splits.
            </p>
            <p>The code is MIT. The data is not covered by that licence.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
