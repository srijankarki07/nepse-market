"use client";

/**
 * The market table: every listed security, paginated, filterable, sortable.
 *
 * ## Paginated because three hundred rows is a wall
 *
 * The whole market for one session is in memory already, so this is not about fetching
 * less. It is about reading: a page of twenty-five rows is scannable and gives the reader
 * a sense of where they are, where three hundred rows is a scroll bar and a shrug. The
 * page size is a constant rather than a control, since nobody has ever wanted to choose.
 *
 * Filtering resets to the first page. Leaving the reader on page 7 of a three-page result
 * is how a filter appears to have returned nothing.
 *
 * ## Sorting and filtering are client-side because there is no server
 *
 * One session arrived as one file, so there is nothing to query and nothing to paginate
 * remotely. Sorting a few hundred rows is instant, and sending it anywhere to be sorted
 * would be slower than doing it here.
 *
 * ## Sort keys are null-aware on purpose
 *
 * A security with no day change sorts last whichever way the column points. Reversing the
 * whole comparison would float a column of dashes to the top of a descending sort, which
 * reads as "these moved the most" when it means "nothing is known about these".
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { Search } from "@/components/icons";
import { Avatar, Chip, Sparkline, type TrendPoint } from "@/components/ui";
import { count, turnover, volume } from "@/lib/format";
import type { MarketRow } from "@/lib/market";

type SortKey = "symbol" | "close" | "change" | "volume" | "turnover";

const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean }> = [
  { key: "symbol", label: "Symbol", numeric: false },
  { key: "close", label: "Close", numeric: true },
  { key: "change", label: "Change", numeric: true },
  { key: "volume", label: "Volume", numeric: true },
  { key: "turnover", label: "Turnover", numeric: true },
];

const PAGE_SIZE = 25;

/**
 * `trends` is a week of closes per ticker, drawn as a sparkline. It is optional so the
 * table still works when the caller has not fetched them: the column disappears rather
 * than rendering a row of empty boxes.
 */
export function MarketTable({
  rows,
  trends,
}: {
  rows: readonly MarketRow[];
  trends?: ReadonlyMap<string, readonly TrendPoint[]>;
}) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("turnover");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(0);

  /*
    Filtering or re-sorting resets to the first page, which is done in the handlers below
    rather than in an effect. An effect would be a second render on every keystroke, and
    the `set-state-in-effect` lint rule is right to refuse it: the change is caused by the
    interaction, so it belongs with the interaction.

    The clamp further down covers the case the handlers cannot: a *data* change that
    shortens the list while the reader is deep in it.
  */

  const sorted = useMemo(() => {
    const needle = filter.trim().toLowerCase();

    const matching =
      needle === ""
        ? [...rows]
        : rows.filter(
            (row) =>
              row.symbol.toLowerCase().includes(needle) ||
              (row.name?.toLowerCase().includes(needle) ?? false),
          );

    const valueOf = (row: MarketRow): number | string | null => {
      if (sortKey === "symbol") return row.symbol;
      if (sortKey === "close") return row.close;
      if (sortKey === "change") return row.change;
      if (sortKey === "volume") return row.volume;
      return row.turnover;
    };

    matching.sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);

      // Unknown sorts last whichever way the column points. Reversing the whole
      // comparison would float a column of dashes to the top of a descending sort.
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;

      const ordering =
        typeof left === "string" ? left.localeCompare(String(right)) : left - Number(right);
      return descending ? -ordering : ordering;
    });

    return matching;
  }, [rows, filter, sortKey, descending]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggle(key: SortKey) {
    setPage(0);

    if (key === sortKey) {
      setDescending((value) => !value);
    } else {
      setSortKey(key);
      // Numbers are most useful biggest-first, names A to Z. That is what a reader
      // clicking a column usually means.
      setDescending(key !== "symbol");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="search"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(0);
            }}
            placeholder="Filter by ticker or company"
            aria-label="Filter the market by ticker or company name"
            className="w-full rounded-md border border-[var(--hairline)] bg-[var(--surface)] py-2 pr-3 pl-9 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <p className="text-xs text-[var(--muted)]">
          {count(sorted.length)} of {count(rows.length)} securities
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--surface)]">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Closing prices for every listed security in the session
          </caption>
          <thead>
            <tr className="border-b border-[var(--hairline)] text-left">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sortKey === column.key ? (descending ? "descending" : "ascending") : "none"
                  }
                  className={`px-4 py-3 font-medium ${column.numeric ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(column.key)}
                    className="inline-flex items-center gap-1 text-[var(--ink-2)] hover:text-[var(--ink)]"
                  >
                    {column.label}
                    <span aria-hidden className="text-[10px] text-[var(--muted)]">
                      {sortKey === column.key ? (descending ? "\u25bc" : "\u25b2") : ""}
                    </span>
                  </button>
                </th>
              ))}
              {trends !== undefined && (
                <th
                  scope="col"
                  aria-label="Seven-day trend"
                  className="px-4 py-3 text-right font-medium text-[var(--ink-2)]"
                >
                  7d
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.symbol}
                className="border-b border-[var(--hairline)] last:border-0 hover:bg-[var(--grid)]/40"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar symbol={row.symbol} size={28} />
                    <Link
                      href={`/symbol/?t=${encodeURIComponent(row.symbol)}`}
                      className="min-w-0 hover:underline"
                    >
                      <span className="font-mono text-[13px] font-semibold">{row.symbol}</span>
                      {row.name !== null && (
                        <span className="block max-w-[16rem] truncate text-xs text-[var(--muted)]">
                          {row.name}
                        </span>
                      )}
                    </Link>
                  </div>
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {row.close === null ? "\u2014" : row.close.toFixed(2)}
                </td>
                {trends !== undefined && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Sparkline symbol={row.symbol} points={trends.get(row.symbol) ?? []} />
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <Chip changePercent={row.changePercent} size="sm" />
                </td>
                <td className="tabular px-4 py-3 text-right text-[var(--ink-2)]">
                  {volume(row.volume)}
                </td>
                <td className="tabular px-4 py-3 text-right text-[var(--ink-2)]">
                  {turnover(row.turnover)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            Nothing matches that filter.
          </p>
        )}
      </div>

      {pageCount > 1 && (
        <nav
          aria-label="Market table pages"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-xs text-[var(--muted)]">
            Showing {count(safePage * PAGE_SIZE + 1)} to{" "}
            {count(Math.min((safePage + 1) * PAGE_SIZE, sorted.length))} of{" "}
            {count(sorted.length)}
          </p>

          <div className="flex items-center gap-1">
            <PageButton onClick={() => setPage(0)} disabled={safePage === 0}>
              First
            </PageButton>
            <PageButton onClick={() => setPage(safePage - 1)} disabled={safePage === 0}>
              Previous
            </PageButton>
            <span className="px-2 text-xs text-[var(--ink-2)]">
              Page {count(safePage + 1)} of {count(pageCount)}
            </span>
            <PageButton
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= pageCount - 1}
            >
              Next
            </PageButton>
            <PageButton
              onClick={() => setPage(pageCount - 1)}
              disabled={safePage >= pageCount - 1}
            >
              Last
            </PageButton>
          </div>
        </nav>
      )}
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--hairline)] px-2.5 py-1 text-xs text-[var(--ink-2)] transition-colors hover:bg-[var(--grid)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
