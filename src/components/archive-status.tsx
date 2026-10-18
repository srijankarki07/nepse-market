"use client";

/**
 * What the archive's health looks like on the page.
 *
 * Two different things, kept visually separate on purpose:
 *
 *   - an **error**, when no session could be read at all, is the page's whole content and
 *     gets the alert treatment and, where retrying can help, a button;
 *   - a **notice**, when the page is showing a verifiable session but not the newest thing
 *     the archive names, sits above the market and explains the date in one sentence.
 *
 * A notice is not an error. The market on screen is real; the only thing withheld is a
 * date that could not be supported, and the reader is told which and why rather than left
 * to wonder why the table looks a day old.
 */

import type { ReactNode } from "react";

import { sessionDate } from "@/lib/format";
import { describeMarketError, type MarketNotice } from "@/lib/market";

/** The page's only state: nothing could be read. */
export function ArchiveErrorPanel({
  error,
  onRetry,
  busy = false,
}: {
  error: unknown;
  onRetry?: () => void;
  busy?: boolean;
}) {
  const { title, detail, retryable } = describeMarketError(error);

  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--down)] bg-[var(--surface)] p-5 text-sm"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-[var(--ink-2)]">{detail}</p>

      {retryable && onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="mt-4 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--plane)] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Trying again…" : "Try again"}
        </button>
      )}
    </div>
  );
}

/** The session on screen, and why the newest date the archive names is not it. */
export function ArchiveNotice({
  notices,
  date,
}: {
  notices: readonly MarketNotice[];
  date: string;
}) {
  if (notices.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-4 text-sm"
    >
      <p className="font-medium">Showing the {sessionDate(date)} session.</p>
      <ul className="mt-1.5 space-y-1 text-[var(--ink-2)]">
        {notices.map((notice) => (
          <li key={`${notice.kind}:${notice.date}`}>{describeNotice(notice)}</li>
        ))}
      </ul>
    </div>
  );
}

/** One notice as a sentence. Exhaustive over the union by construction. */
function describeNotice(notice: MarketNotice): ReactNode {
  const date = sessionDate(notice.date);

  switch (notice.kind) {
    case "unavailable":
      return (
        <>
          <span className="font-medium">{date}</span> is named by the archive, but its
          session file is not available yet.
        </>
      );
    case "empty":
      return (
        <>
          <span className="font-medium">{date}</span> holds no scrips, so it is treated as
          an unreadable session rather than a day&rsquo;s trading.
        </>
      );
    case "repeated":
      return (
        <>
          <span className="font-medium">{date}</span> repeats the previous session&rsquo;s
          figures exactly, so it is treated as a non-trading day rather than shown as a new
          session.
        </>
      );
    case "previous-unavailable":
      return (
        <>
          The <span className="font-medium">{date}</span> session could not be read, so day
          changes are shown as dashes until it is.
        </>
      );
    case "session-list-unavailable":
      return (
        <>
          The archive&rsquo;s session list could not be read, so day changes are shown as
          dashes. The session above is the newest one this site could read.
        </>
      );
    case "stale":
      return (
        <>
          The archive has not published a session since{" "}
          <span className="font-medium">{date}</span>. The figures below are from that
          session.
        </>
      );
  }
}
