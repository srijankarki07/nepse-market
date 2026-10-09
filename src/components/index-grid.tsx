/**
 * The exchange's own index levels, as a grid.
 *
 * ## Why a grid rather than the rail this used to be
 *
 * Seventeen levels do not fit across a phone and did not fit across a laptop either, so this
 * was a horizontal rail: one row, scrolled sideways. What that hid was the data. A reader who
 * did not think to drag a strip that looked like a finished row saw the four headline levels
 * and the sector tiles ran off the edge — "Finance" cut in half at the right margin is what it
 * looked like, not "there are thirteen more".
 *
 * Every other block on this page is a grid, so the rail was also the one thing that behaved
 * differently for no reason a reader could see. A grid shows all seventeen at once and wraps
 * on its own. It costs height, and that is the trade: five rows of tiles on a laptop instead of
 * one row with the rest invisible.
 *
 * Four columns at `lg` is deliberate. The four headline levels are ordered first, so they fill
 * the first row exactly and the sectors start on the second — the same separation the ordering
 * makes, without a second list to keep in step with this one.
 *
 * ## Why the site's own index is deliberately not beside these
 *
 * The plan for this section called for the computed index to sit next to the exchange's levels.
 * It does not, and the reason is that the two are not comparable, so placing them side by side
 * would invite a false reading rather than make one:
 *
 *   - **The levels are on different scales.** The computed index is chained from 100 by
 *     construction, so "128.42" sitting beside NEPSE's "2,572.34" says nothing except that
 *     they were measured differently. A reader would reasonably try to compare them.
 *   - **The changes mean different things.** Each level here carries the *day's* move, which
 *     is what the exchange publishes. The computed index's headline change is over the range
 *     selected above it, so the two chips would answer different questions under one heading.
 *
 * The section above already presents the computed index, labelled as equal-weighted and
 * footnoted as not NEPSE's. Keeping the distinction in words there and the exchange's real
 * levels here is the honest arrangement.
 *
 * ## The labels are the source's, not this site's
 *
 * "Banking SubIndex", "HydroPower Index" and "Non Life Insurance" are what the exchange
 * calls them. They are not tidied into a house style, because a reader matching this grid
 * against a broker's screen should see the same words in the same order of importance.
 */

import type { IndexLevel } from "@srijankarki44/nepse-data";

import { Chip } from "./ui";
import { price, signed } from "@/lib/format";

/**
 * The four headline levels, in the exchange's own order, before the sectors.
 *
 * The archive returns them sorted by key, which is a stable order but not a meaningful one:
 * it would open the grid on `banking` and bury NEPSE in the middle. The sectors follow in
 * the archive's order, which is alphabetical by name.
 */
const HEADLINE = ["nepse", "sensitive", "float", "sensitive-float"];

function inDisplayOrder(levels: readonly IndexLevel[]): IndexLevel[] {
  const rank = (key: string): number => {
    const at = HEADLINE.indexOf(key);
    return at === -1 ? HEADLINE.length : at;
  };

  return [...levels].sort((a, b) => {
    const byRank = rank(a.key) - rank(b.key);
    if (byRank !== 0) return byRank;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

export function IndexGrid({ levels }: { levels: readonly IndexLevel[] }) {
  const ordered = inDisplayOrder(levels);

  return (
    <ul
      // A list, so a screen reader is told how many levels there are. Two columns on a phone
      // because a level is a name, a figure and a change, and one column of seventeen would be
      // most of a screen; four from `lg`, which is where the headline row starts filling
      // exactly and the tiles still hold the longest sector name without truncating.
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {ordered.map((level) => (
        <li
          key={level.key}
          className="min-w-0 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4"
        >
          <p className="truncate text-xs text-[var(--muted)]" title={level.name}>
            {level.name}
          </p>

          <p className="tabular mt-1 text-lg font-semibold">{price(level.close)}</p>

          <p className="mt-2 flex items-baseline gap-2">
            <Chip changePercent={level.percentChange} size="sm" />
            <span className="tabular text-[11px] text-[var(--ink-2)]">{signed(level.change)}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
