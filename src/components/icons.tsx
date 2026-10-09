/**
 * The icons, hand-rolled.
 *
 * This repo has no icon dependency, and the three it would need for a whole dashboard are
 * not worth pulling a package for. These are 24-unit stroke outlines that inherit
 * `currentColor`, so an icon takes the colour of whatever it sits in, which is what lets a
 * stat tile tint its own icon without the icon knowing anything about the palette.
 *
 * They are decorative: every one is `aria-hidden` and every place one is used also states
 * the thing in text. An icon that carried meaning on its own would be a second vocabulary
 * for the reader to learn.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Rising line, for a gain. */
export const TrendUp = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Icon>
);

/** Falling line, for a loss. */
export const TrendDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 7l6 6 4-4 8 8" />
    <path d="M15 17h6v-6" />
  </Icon>
);

/** A pulse, for a session's activity. */
export const Activity = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  </Icon>
);

/** A note, for turnover. */
export const Banknote = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </Icon>
);

/** Stacked sheets, for shares traded. */
export const Layers = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Icon>
);

/** A slip, for transactions. */
export const Receipt = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z" />
    <path d="M9 9h6M9 13h6" />
  </Icon>
);

/** A grid, for how many scrips are listed. */
export const Grid = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

/** A calendar, for a session date. */
export const Calendar = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

/** A terminal prompt, for the package section. */
export const Terminal = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
    <path d="M7 10l2.5 2L7 14M12.5 14H17" />
  </Icon>
);

/** An outward arrow, for a link that leaves the site. */
export const ArrowUpRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </Icon>
);

/** A magnifier, for the table's filter. */
export const Search = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);
