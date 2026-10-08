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
 * ## The animation is CSS, deliberately
 *
 * A scripted typewriter would need a timer, state, and an effect to drive them, and it
 * would leave a screen reader reading a half-typed line. Clipping a monospace line with
 * `steps()` gets the same effect with none of that, and collapses to the finished state
 * under `prefers-reduced-motion` because the transcript was never generated.
 */

export type TerminalLine =
  | { readonly kind: "command"; readonly text: string }
  | { readonly kind: "output"; readonly text: string; readonly tone?: "key" | "str" | "num" | "dim" }
  | { readonly kind: "blank" };

// `num` is the `-ink` green: the transcript sits on `--surface`, which is the light one in
// the light theme, and this is 13px text rather than a mark. See the palette note.
const TONE: Record<string, string> = {
  key: "text-[var(--accent)]",
  str: "text-[var(--code-str)]",
  num: "text-[var(--up-ink)]",
  dim: "text-[var(--muted)]",
};

/** Milliseconds per typed character, and the pause before output starts. */
const PER_CHAR = 42;
const AFTER_COMMAND = 320;
const OUT_LINE = 110;

/** How long a line occupies the transcript, which is also the delay before the next one. */
function durationOf(line: TerminalLine): number {
  if (line.kind === "command") return line.text.length * PER_CHAR + AFTER_COMMAND;
  if (line.kind === "output") return OUT_LINE;
  return 0;
}

export function Terminal({
  title,
  lines,
  className = "",
}: {
  title: string;
  lines: readonly TerminalLine[];
  className?: string;
}) {
  /*
   * The delays are computed during render rather than tracked in state: the transcript is
   * fixed, so its timing is a pure function of it, and there is nothing here that needs to
   * change after mount. Folded rather than accumulated in a loop variable, because mutating
   * during render is what the compiler rules forbid.
   */
  const timed = lines
    .reduce<{ at: number; rows: { line: TerminalLine; start: number }[] }>(
      (state, line) => ({
        at: state.at + durationOf(line),
        rows: [...state.rows, { line, start: state.at }],
      }),
      { at: 0, rows: [] },
    )
    .rows.map((row, index) => ({ ...row, key: index }));

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--surface)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--down)] opacity-70" />
          <span className="size-2.5 rounded-full bg-[var(--flat)] opacity-50" />
          <span className="size-2.5 rounded-full bg-[var(--up)] opacity-60" />
        </span>
        <p className="truncate font-mono text-[11px] text-[var(--muted)]">{title}</p>
      </div>

      {/* `overflow-x-auto` so a long line on a phone scrolls inside the window rather than
          pushing the page sideways. */}
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
        <code>
          {timed.map(({ line, start, key }) => {
            if (line.kind === "blank") return <span key={key}>{"\n"}</span>;

            if (line.kind === "command") {
              return (
                <span key={key} className="block">
                  <span aria-hidden="true" className="text-[var(--muted)] select-none">
                    ${" "}
                  </span>
                  <span
                    className="terminal-command"
                    style={
                      {
                        animationDelay: `${start}ms`,
                        animationDuration: `${line.text.length * PER_CHAR}ms`,
                        "--chars": line.text.length,
                      } as React.CSSProperties
                    }
                  >
                    {line.text}
                  </span>
                  <span aria-hidden="true" className="terminal-caret">
                    &nbsp;
                  </span>
                </span>
              );
            }

            return (
              <span
                key={key}
                className={`terminal-out block whitespace-pre ${TONE[line.tone ?? ""] ?? ""}`}
                style={{ animationDelay: `${start}ms` }}
              >
                {line.text}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
