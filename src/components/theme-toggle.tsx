"use client";

/**
 * Light and dark, switched by the reader.
 *
 * ## No React state, deliberately
 *
 * The button's label has to agree with the theme that is actually on screen, and the
 * theme lives on `<html>` as `data-theme`, stamped before first paint by a script in the
 * document head. Mirroring that into React state would mean reading `localStorage` during
 * render, which the server cannot do, so the first paint would disagree with the markup
 * and React would report a hydration mismatch.
 *
 * So the button reads the live theme off the DOM when clicked, and which icon shows is
 * decided in CSS from the same attribute. One source of truth, no state, nothing to
 * desynchronise.
 *
 * ## Three states, not two
 *
 * With no stamp, the page follows the operating system. The first click resolves that to
 * an explicit choice, because a reader who has just clicked a theme button has expressed
 * a preference and should not have it overridden by a laptop dimming itself at dusk.
 */

const STORAGE_KEY = "nepse-theme";

function currentTheme(): "light" | "dark" {
  const stamped = document.documentElement.dataset["theme"];
  if (stamped === "light" || stamped === "dark") return stamped;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset["theme"] = next;

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked or full. The theme still applies for this page; it just
      // will not be remembered, which is a lesser failure than the button not working.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // The label says what the click does, not what the current state is, which is what
      // a screen reader user needs to hear before activating it.
      aria-label="Switch between light and dark"
      title="Switch between light and dark"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--hairline)] text-[var(--ink-2)] transition-colors hover:bg-[var(--grid)]"
    >
      <SunIcon />
      <MoonIcon />
    </button>
  );
}

/** Shown in light mode. Visibility is CSS's job, not this component's. */
function SunIcon() {
  return (
    <svg
      className="theme-sun"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="theme-moon"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
