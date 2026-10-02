/**
 * Turning the archive's numbers into something a person can read.
 *
 * ## An absent value is a dash, never a zero
 *
 * The archive writes a missing price as an empty field, and the client returns `null`.
 * Rendering that as `0` — or as `0.00`, which is what a naive formatter does — would turn
 * "this scrip did not trade" into "this scrip is worth nothing". The dash is the whole
 * point of the `null`, so it has to survive all the way to the screen.
 *
 * ## Prices are not currency-formatted
 *
 * They are quoted in NPR and every figure on the page is NPR, so repeating the symbol
 * would be noise. Grouping and two decimals, nothing else.
 */

const NBSP = " ";

/** A price, grouped and to two decimals. `null` becomes a dash. */
export function price(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A count, grouped. `null` becomes a dash. */
export function count(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}

/** An unsigned change, with the sign made explicit so a rise and a fall read alike. */
export function signed(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

/** A percentage, signed. `null` — an unknown baseline — becomes a dash. */
export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const formatted = Math.abs(value).toFixed(2);
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `−${formatted}%`;
  return `${formatted}%`;
}

/**
 * Turnover, abbreviated.
 *
 * A day's turnover runs to nine figures, and a column of them is unreadable at full
 * width. The abbreviations are the ones a Nepali reader expects — lakh and crore, not
 * million and billion — because those are how the figures are discussed here.
 */
export function turnover(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";

  const crore = 10_000_000;
  const lakh = 100_000;

  if (Math.abs(value) >= crore) return `${(value / crore).toFixed(2)}${NBSP}Cr`;
  if (Math.abs(value) >= lakh) return `${(value / lakh).toFixed(2)}${NBSP}L`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Volume, abbreviated the same way. */
export function volume(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";

  const lakh = 100_000;
  const thousand = 1_000;

  if (Math.abs(value) >= lakh) return `${(value / lakh).toFixed(2)}${NBSP}L`;
  if (Math.abs(value) >= thousand) return `${(value / thousand).toFixed(1)}${NBSP}K`;
  return String(value);
}

/** `2026-10-01` as `1 Oct 2026`. Rendered in UTC so the date never shifts under a reader. */
export function sessionDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The direction of a change, for colouring. Zero is neither, and is not coloured. */
export function direction(value: number | null | undefined): "up" | "down" | "flat" {
  if (value === null || value === undefined || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

/** The text colour for a change, as Tailwind classes. */
export function changeColor(value: number | null | undefined): string {
  const which = direction(value);
  if (which === "up") return "text-emerald-600 dark:text-emerald-400";
  if (which === "down") return "text-rose-600 dark:text-rose-400";
  return "text-neutral-500 dark:text-neutral-400";
}
