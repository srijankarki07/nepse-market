"use client";

/**
 * The market table — every scrip, filterable and sortable.
 *
 * ## Sorting and filtering are client-side because there is no server
 *
 * The whole market for one session is in memory already: it arrived as a single file. So
 * there is nothing to query and nothing to paginate — sorting a few hundred rows is
 * instant, and sending it anywhere to be sorted would be slower than doing it here.
 *
 * ## Sort keys are `null`-aware on purpose
 *
 * A scrip with no day change sorts last rather than as zero. Sorting it among the
 * unchanged would put "we do not know" in the middle of "it did not move", which is the
 * distinction the dashes exist to preserve.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { changeColor, count, percent, price, signed, turnover, volume } from "@/lib/format";
import type { MarketRow } from "@/lib/market";

type SortKey = "symbol" | "close" | "change" | "volume" | "turnover";

const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean }> = [
  { key: "symbol", label: "Symbol", numeric: false },
  { key: "close", label: "Close", numeric: true },
  { key: "change", label: "Change", numeric: true },
  { key: "volume", label: "Volume", numeric: true },
  { key: "turnover", label: "Turnover", numeric: true },
];

export function MarketTable({ rows }: { rows: readonly MarketRow[] }) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("turnover");
  const [descending, setDescending] = useState(true);

  const visible = useMemo(() => {
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

      // Unknown sorts last whichever way the column is pointing. Reversing the whole
      // comparison would otherwise float a column of dashes to the top of a descending
      // sort, which reads as "these moved the most".
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;

      const ordering = typeof left === "string" ? left.localeCompare(String(right)) : left - Number(right);
      return descending ? -ordering : ordering;
    });

    return matching;
  }, [rows, filter, sortKey, descending]);

  function toggle(key: SortKey) {
    if (key === sortKey) setDescending((value) => !value);
    else {
      setSortKey(key);
      // Numbers are most useful biggest-first and names A–Z, which is what a reader
      // clicking a column usually means.
      setDescending(key !== "symbol");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by ticker or company"
          aria-label="Filter the market by ticker or company name"
          className="w-full max-w-xs rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--axis)]"
        />
        <p className="text-xs text-[var(--muted)]">
          {count(visible.length)} of {count(rows.length)} scrips
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--hairline)] bg-[var(--surface)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--hairline)] text-left">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sortKey === column.key ? (descending ? "descending" : "ascending") : "none"
                  }
                  className={`px-3 py-2 font-medium ${column.numeric ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(column.key)}
                    className="inline-flex items-center gap-1 text-[var(--ink-2)] hover:text-[var(--ink)]"
                  >
                    {column.label}
                    <span aria-hidden className="text-[10px] text-[var(--muted)]">
                      {sortKey === column.key ? (descending ? "▼" : "▲") : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.symbol}
                className="border-b border-[var(--hairline)] last:border-0 hover:bg-[var(--grid)]/40"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/symbol/?t=${encodeURIComponent(row.symbol)}`}
                    className="font-medium hover:underline"
                  >
                    {row.symbol}
                  </Link>
                  {row.name !== null && (
                    <span className="block max-w-[18rem] truncate text-xs text-[var(--muted)]">
                      {row.name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular text-right">{price(row.close)}</td>
                <td className={`px-3 py-2 tabular text-right ${changeColor(row.change)}`}>
                  {signed(row.change)}
                  <span className="block text-xs opacity-80">{percent(row.changePercent)}</span>
                </td>
                <td className="px-3 py-2 tabular text-right text-[var(--ink-2)]">
                  {volume(row.volume)}
                </td>
                <td className="px-3 py-2 tabular text-right text-[var(--ink-2)]">
                  {turnover(row.turnover)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
            No scrip matches “{filter}”.
          </p>
        )}
      </div>
    </div>
  );
}
