"use client";

/**
 * The package, running.
 *
 * ## Why a terminal and not a code block
 *
 * The site already showed a snippet beside a dashboard and the relationship had to be
 * explained. A terminal shows the same thing as a sequence: the command goes in, the
 * numbers come out, and the reader watches it happen. It is the package's own claim, made
 * visually, in the one place a developer already looks for it.
 *
 * ## The text is real, and so are the figures
 *
 * Every line is in the DOM from the first paint, only revealed by CSS, so it can be
 * selected, copied and read aloud. The values inside it are read from the archive at
 * runtime, the same session the rest of the page is showing, because a hero that printed
 * invented prices would be a lie in the most prominent place on the site.
 *
 * ## The animation is CSS, deliberately; the scrolling is not
 *
 * A scripted typewriter would need a timer, state, and an effect to drive them, and it
 * would leave a screen reader reading a half-typed line. Clipping a monospace line with
 * `steps()` gets the same effect with none of that, and collapses to the finished state
 * under `prefers-reduced-motion` because the transcript was never generated.
 *
 * Scrolling is the one thing CSS cannot do here, and it is worth saying why. Every line is
 * in the DOM from the start and merely transparent, so it occupies its space from the first
 * paint: the window's scroll height never changes, and there is no "content growing" for a
 * scroll container to follow. So the effect below does the following instead, bringing each
 * line into view as it is revealed. It moves the window; it never touches the text.
 */

import { useEffect, useMemo, useRef } from "react";

import { Skeleton } from "./ui";

/**
 * The shell prompt and the REPL prompt, which are not the same character.
 *
 * Realism is the whole point of the device, and a transcript that answers a `$` prompt with
 * a JavaScript expression is the kind of detail that reads as wrong to anyone who uses a
 * terminal. `$` is a shell, `>` is Node waiting for an expression.
 */
export type TerminalPrompt = "$" | ">";

/**
 * What a run of text in the transcript is, for the syntax colours.
 *
 * `pkg` is the odd one out: it is not a syntax category at all, it is the names this site
 * cares about, `npm`, `node` and the package itself, and it takes `--accent` because the
 * accent already means "the thing you came here for". The rest are the usual categories.
 *
 * `num` takes the data green rather than a syntax colour, deliberately. Every number in
 * this transcript is one of the archive's own figures, so it is coloured like every other
 * figure on the site: it is data that happens to be inside a code sample, not code that
 * happens to look like data.
 */
export type TerminalTone = "pkg" | "key" | "fn" | "str" | "num" | "dim";

/** One run of text, with the colour it carries. Runs with no tone are left at `--ink`. */
export interface TerminalSpan {
  readonly text: string;
  readonly tone?: TerminalTone;
}

/**
 * A line's content: a plain string for the lines that are one colour, spans for the ones
 * that are not.
 *
 * The union rather than spans everywhere because most lines genuinely are one colour, and
 * forcing `[{ text: "added 1 package" }]` on the reader of that transcript buys nothing.
 */
export type LineText = string | readonly TerminalSpan[];

export type TerminalLine =
  | {
      readonly kind: "command";
      readonly text: LineText;
      readonly prompt?: TerminalPrompt;
    }
  | { readonly kind: "output"; readonly text: LineText }
  | { readonly kind: "blank" };

const TONE: Record<TerminalTone, string> = {
  pkg: "text-[var(--accent)]",
  key: "text-[var(--code-kw)]",
  fn: "text-[var(--code-fn)]",
  str: "text-[var(--code-str)]",
  num: "text-[var(--up-ink)]",
  dim: "text-[var(--code-cm)]",
};

/** A line's spans, whether it was written as one or as a list. */
function spansOf(text: LineText): readonly TerminalSpan[] {
  return typeof text === "string" ? [{ text }] : text;
}

/** The line's characters, which is what the typing animation counts. */
function textOf(text: LineText): string {
  return spansOf(text)
    .map((span) => span.text)
    .join("");
}

/**
 * The rhythm of the session.
 *
 * These are the numbers that make it read as a terminal rather than as a paragraph being
 * revealed, and they are separated rather than one constant because the three beats are
 * genuinely different lengths in a real session:
 *
 *   - typing is fast and even, so it is one number per character;
 *   - a command then goes away and does something, which is the longest pause and the one
 *     the eyes read as "the request is out";
 *   - a response arrives as several lines in quick succession, not all at once.
 */
const PER_CHAR = 40;

/** Between the last character of a command and its first line of output. */
const AFTER_COMMAND = 430;

/** Between two lines of the same response. */
const BETWEEN_OUTPUTS = 95;

/** A blank line is a breath between commands, not an instant. */
const BLANK = 220;

/** How long a line occupies the transcript, which is also the delay before the next one. */
function durationOf(line: TerminalLine): number {
  if (line.kind === "command")
    return textOf(line.text).length * PER_CHAR + AFTER_COMMAND;
  if (line.kind === "output") return BETWEEN_OUTPUTS;
  return BLANK;
}

/** How long a command's own line takes to type, which is how long its caret lives. */
function typingDuration(line: TerminalLine): number {
  return line.kind === "command" ? textOf(line.text).length * PER_CHAR : 0;
}

export function Terminal({
  title,
  lines,
  className = "",
}: {
  title: string;
  /**
   * The transcript, or `null` while the session it describes is still being read.
   *
   * `null` rather than an empty array, because the two mean different things here: an empty
   * transcript is a window with nothing in it, and a missing one is a window waiting for
   * figures it cannot invent. The chrome is drawn either way, so the hero does not change
   * size when the data lands.
   */
  lines: readonly TerminalLine[] | null;
  className?: string;
}) {
  /*
   * The delays are computed from the transcript rather than tracked in state: it is fixed,
   * so its timing is a pure function of it, and nothing here changes after mount. Folded
   * rather than accumulated in a loop variable, because mutating during render is what the
   * compiler rules forbid.
   *
   * Memoised on `lines`, which its caller is responsible for holding steady. `Hero` does:
   * it derives the transcript once per session rather than once per render. Without that
   * this would recompute on every render and restart the whole animation each time.
   */
  const timed = useMemo(
    () =>
      (lines ?? [])
        .reduce<{ at: number; rows: { line: TerminalLine; start: number }[] }>(
          (state, line) => ({
            at: state.at + durationOf(line),
            rows: [...state.rows, { line, start: state.at }],
          }),
          { at: 0, rows: [] },
        )
        .rows.map((row, index) => ({ ...row, key: index })),
    [lines],
  );

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const body = bodyRef.current;
    if (body === null) return;

    // Reduced motion reveals the whole transcript at once, so there is nothing to follow
    // and the window is left where it is for the reader to scroll themselves.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /** The height of the fade at the bottom of the window. Mirrors `.terminal-body`. */
    const FADE = 88;

    /*
     * Measured to the last line of text rather than to `scrollHeight`, because the window's
     * content carries deliberate bottom padding for the followed line to scroll into. That
     * padding is not transcript, and counting it would report an overflow on a desktop where
     * nothing is actually out of view.
     */
    const container = body.getBoundingClientRect();
    const lastLine = [...lineRefs.current]
      .reverse()
      .find((line) => line !== null);
    if (lastLine === null || lastLine === undefined) return;

    const textBottom =
      lastLine.getBoundingClientRect().bottom - container.top + body.scrollTop;
    const overflow = textBottom - body.clientHeight;

    /*
     * A little overflow is left alone, and this is the decision worth spelling out.
     *
     * Following every line means the transcript ends scrolled, which puts the `npm install`
     * line out of view. That line is the one thing the hero exists to show, so a window that
     * scrolls to accommodate a transcript it almost fits is trading the message for the
     * tail. Instead the tail dissolves into the fade, which is what the fade is for.
     *
     * In practice this never fires, and that is worth knowing rather than assuming. The
     * transcript's lines are wider than a phone and `w-max` keeps them on one line each, so
     * the content is exactly as tall at 320px as at 1440px and the window is sized to it.
     * This is a guard for the day the transcript is lengthened, not a phone fix. If it ever
     * does run it is the same behaviour, just larger: follow the line that is being written.
     */
    if (overflow <= FADE) return;

    /**
     * Keeps the line being revealed clear of the bottom edge, where the fade is.
     *
     * Larger than the fade, deliberately. Scrolling only as far as the edge would leave the
     * newest line sitting inside the dissolve, which is exactly the line the reader is
     * meant to be watching. This is the fade's 2.5rem plus a margin.
     */
    const PAD = 48;

    const timers = timed.map(({ start }, index) =>
      window.setTimeout(
        () => {
          const line = lineRefs.current[index];
          if (line === null || line === undefined) return;

          const lineBox = line.getBoundingClientRect();
          const bodyBox = body.getBoundingClientRect();
          const below = lineBox.bottom - (bodyBox.bottom - PAD);

          // Only ever scrolls down, and only as far as it must. Scrolling the element into
          // view by the browser's own means would also move the page, which on a hero is
          // the whole viewport.
          if (below > 0)
            body.scrollTo({ top: body.scrollTop + below, behavior: "smooth" });
        },
        start + typingDuration(timed[index]?.line ?? { kind: "blank" }),
      ),
    );

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [timed]);

  return (
    <div
      // The edge comes from a token rather than a `dark:` variant, and that is the repo's
      // rule rather than a preference: `dark:` follows `prefers-color-scheme` only, so a
      // reader on a dark machine who has explicitly chosen the light theme would get this
      // border removed from the light theme. The token is set in both arms of both dark
      // blocks, which is what makes the two agree.
      className={`relative overflow-hidden rounded-xl border border-[var(--terminal-edge)] bg-[var(--surface)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--down)] opacity-70" />
          <span className="size-2.5 rounded-full bg-[var(--flat)] opacity-50" />
          <span className="size-2.5 rounded-full bg-[var(--up)] opacity-60" />
        </span>
        <p className="truncate font-mono text-[11px] text-[var(--muted)]">
          {title}
        </p>
      </div>

      {/* The window. A fixed height, a soft bottom edge, and scrolling if the transcript
          outgrows it. See `.terminal-body` in globals.css. */}
      <div ref={bodyRef} className="terminal-body">
        {/*
          `w-max min-w-full` so a long line scrolls inside the window rather than pushing the
          page sideways.

          `pb-14` is load-bearing and looks like stray padding. Scrolling to the very bottom
          puts the last line's bottom edge at the window's bottom edge, which is inside the
          fade, so without room to scroll past it the final line of the transcript would be
          permanently dimmed. The padding is what the window scrolls into.
        */}
        {lines === null ? (
          /*
           * The window before the session exists. Ragged widths rather than equal bars,
           * because a transcript is ragged and this is standing in for one.
           */
          <div className="space-y-3 px-4 py-4">
            {["w-3/5", "w-2/5", "w-4/5", "w-1/2", "w-11/12", "w-1/3"].map((width) => (
              <Skeleton key={width} className={`block h-4 ${width}`} />
            ))}
          </div>
        ) : (
        <pre className="w-max min-w-full px-4 pt-4 pb-24 font-mono text-[12.5px] leading-relaxed">
          <code>
            {timed.map(({ line, start, key }) => {
              if (line.kind === "blank") {
                return (
                  <span
                    key={key}
                    ref={(node) => {
                      lineRefs.current[key] = node;
                    }}
                    className="block"
                  >
                    {"\n"}
                  </span>
                );
              }

              if (line.kind === "command") {
                return (
                  <span
                    key={key}
                    ref={(node) => {
                      lineRefs.current[key] = node;
                    }}
                    className="block"
                  >
                    {/*
                      The prompt is revealed with its own command rather than being there
                      from the first paint. It used to be static, so every `$` in the
                      transcript was visible immediately and the window read as a list of
                      finished commands rather than one being typed.
                    */}
                    <span
                      aria-hidden="true"
                      className="terminal-appears text-[var(--muted)] select-none"
                      style={{ animationDelay: `${start}ms` }}
                    >
                      {line.prompt ?? "$"}{" "}
                    </span>
                    <span
                      className="terminal-command"
                      style={
                        {
                          animationDelay: `${start}ms`,
                          animationDuration: `${typingDuration(line)}ms`,
                          "--chars": textOf(line.text).length,
                        } as React.CSSProperties
                      }
                    >
                      {spansOf(line.text).map((span, at) => (
                        <span
                          key={at}
                          className={
                            span.tone === undefined ? "" : TONE[span.tone]
                          }
                        >
                          {span.text}
                        </span>
                      ))}
                    </span>
                    {/*
                      The caret lives for exactly as long as its own command types. It used
                      to blink forever on every command line, so the transcript ended up
                      with a dozen of them going at once.
                    */}
                    <span
                      aria-hidden="true"
                      className="terminal-caret"
                      style={
                        {
                          "--caret-at": `${start}ms`,
                          "--caret-life": `${typingDuration(line)}ms`,
                        } as React.CSSProperties
                      }
                    >
                      &nbsp;
                    </span>
                  </span>
                );
              }

              return (
                <span
                  key={key}
                  ref={(node) => {
                    lineRefs.current[key] = node;
                  }}
                  className="terminal-appears block whitespace-pre"
                  style={{ animationDelay: `${start}ms` }}
                >
                  {spansOf(line.text).map((span, at) => (
                    <span
                      key={at}
                      className={span.tone === undefined ? "" : TONE[span.tone]}
                    >
                      {span.text}
                    </span>
                  ))}
                </span>
              );
            })}
          </code>
        </pre>
        )}
      </div>

      {/* The window's bottom edge, dissolving into the page. See `.terminal-blend`. */}
      <div aria-hidden="true" className="terminal-blend" />
    </div>
  );
}
