/**
 * The Prominence icon sprite.
 *
 * Ported verbatim from the design: same ids, same 16x16 grid, same stroke
 * geometry. Icons draw in `currentColor`, so colour comes from the element
 * they sit in rather than from the sprite.
 *
 * Held as DATA rather than 34 hand-written JSX blocks: the geometry is a static
 * asset copied from the design, and keeping it in one table makes a re-port a
 * regeneration instead of a merge. `d` is the symbol's inner markup and is
 * injected as-is — it is our own build-time constant, never user input.
 */

/** Every icon the design defines. A typo is a type error, not a blank square. */
export type IconName =
  | "i-grid"
  | "i-search"
  | "i-globe"
  | "i-link"
  | "i-swords"
  | "i-sparkle"
  | "i-trend"
  | "i-bookmark"
  | "i-clipboard"
  | "i-plug"
  | "i-layers"
  | "i-phone"
  | "i-help"
  | "i-user"
  | "i-bell"
  | "i-chev-down"
  | "i-chev-right"
  | "i-check"
  | "i-alert"
  | "i-x"
  | "i-clock"
  | "i-arrow-up"
  | "i-arrow-down"
  | "i-external"
  | "i-filter"
  | "i-download"
  | "i-refresh"
  | "i-play"
  | "i-message"
  | "i-coin"
  | "i-plus"
  | "i-chart"
  | "i-google-color"
  | "i-google";

type IconDef = {
  viewBox: string;
  fill: string;
  stroke: string;
  strokeWidth?: string;
  /** SVG enums, not free strings — React types them and so does the spec. */
  strokeLinecap?: "round" | "butt" | "square" | "inherit";
  strokeLinejoin?: "round" | "miter" | "bevel" | "inherit";
  /** Inner markup of the <symbol>. */
  d: string;
};

const ICONS: Record<IconName, IconDef> = {
  "i-grid": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<rect x="2.2" y="2.2" width="5" height="5" rx="1.2"></rect><rect x="8.8" y="2.2" width="5" height="5" rx="1.2"></rect><rect x="2.2" y="8.8" width="5" height="5" rx="1.2"></rect><rect x="8.8" y="8.8" width="5" height="5" rx="1.2"></rect>',
  },
  "i-search": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<circle cx="7" cy="7" r="4.3"></circle><path d="M10.2 10.2 14 14"></path>',
  },
  "i-globe": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<circle cx="8" cy="8" r="6"></circle><path d="M2 8h12"></path><path d="M8 2c2 2.2 2 9.8 0 12"></path><path d="M8 2C6 4.2 6 11.8 8 14"></path>',
  },
  "i-link": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M6.6 9.4a3 3 0 0 1 0-4.2l1.7-1.7a3 3 0 0 1 4.2 4.2l-.9.9"></path><path d="M9.4 6.6a3 3 0 0 1 0 4.2l-1.7 1.7a3 3 0 0 1-4.2-4.2l.9-.9"></path>',
  },
  "i-swords": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M2.6 2.6 9.4 9.4"></path><path d="M13.4 2.6 6.6 9.4"></path><path d="m4.4 13.4 2.3-2.3"></path><path d="m11.6 13.4-2.3-2.3"></path>',
  },
  "i-sparkle": {
    viewBox: "0 0 16 16",
    fill: "currentColor",
    stroke: "none",
    d: '<path d="M8 2.2 9.4 6.6 13.8 8 9.4 9.4 8 13.8 6.6 9.4 2.2 8 6.6 6.6Z"></path>',
  },
  "i-trend": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="m2 11.6 4-4 2.5 2.5L14 4.6"></path><path d="M10.4 4.6H14V8.2"></path>',
  },
  "i-bookmark": {
    viewBox: "0 0 16 16",
    fill: "currentColor",
    stroke: "none",
    d: '<path d="M4.2 2.8h7.6v10.4L8 10.6l-3.8 2.6Z"></path>',
  },
  "i-clipboard": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<rect x="3.4" y="3.2" width="9.2" height="10.6" rx="1.5"></rect><path d="M6.2 3.2V2.6a.8.8 0 0 1 .8-.8h2a.8.8 0 0 1 .8.8v.6"></path><path d="m6.2 8.6 1.5 1.5 2.6-2.8"></path>',
  },
  "i-plug": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<rect x="3.2" y="5.4" width="9.6" height="7.2" rx="1.6"></rect><path d="M6.2 5.4V2.8"></path><path d="M9.8 5.4V2.8"></path><path d="M6.4 8.8h3.2"></path>',
  },
  "i-layers": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="m8 2.2 6 3.1-6 3.1-6-3.1Z"></path><path d="m2 9.4 6 3.1 6-3.1"></path>',
  },
  "i-phone": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<rect x="4.4" y="1.8" width="7.2" height="12.4" rx="1.6"></rect><path d="M7 12.2h2"></path>',
  },
  "i-help": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<circle cx="8" cy="8" r="6"></circle><path d="M6.4 6.3a1.7 1.7 0 1 1 2.2 1.9c-.4.2-.6.5-.6.9v.3"></path><path d="M8 11.7h.01"></path>',
  },
  "i-user": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<circle cx="8" cy="5.6" r="2.6"></circle><path d="M3.4 13.4a4.8 4.8 0 0 1 9.2 0"></path>',
  },
  "i-bell": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M4.6 6.9a3.4 3.4 0 0 1 6.8 0c0 3 1.2 3.8 1.2 3.8H3.4s1.2-.8 1.2-3.8Z"></path><path d="M6.8 12.6a1.4 1.4 0 0 0 2.4 0"></path>',
  },
  "i-chev-down": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="m4 6.4 4 4 4-4"></path>',
  },
  "i-chev-right": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="m6.4 4 4 4-4 4"></path>',
  },
  "i-check": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="m3.4 8.4 3.1 3.1L12.6 5"></path>',
  },
  "i-alert": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M8 2.6 14.2 13.4H1.8Z"></path><path d="M8 6.4v3"></path><path d="M8 11.4h.01"></path>',
  },
  "i-x": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="m4.2 4.2 7.6 7.6"></path><path d="M11.8 4.2 4.2 11.8"></path>',
  },
  "i-clock": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<circle cx="8" cy="8" r="6"></circle><path d="M8 4.6V8l2.4 1.6"></path>',
  },
  "i-arrow-up": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M8 13V3.4"></path><path d="m4.2 7.2 3.8-3.8 3.8 3.8"></path>',
  },
  "i-arrow-down": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M8 3v9.6"></path><path d="m4.2 8.8 3.8 3.8 3.8-3.8"></path>',
  },
  "i-external": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M9.6 2.8H13.2V6.4"></path><path d="M13.2 2.8 7.8 8.2"></path><path d="M12 9.4v2.4a1.4 1.4 0 0 1-1.4 1.4H4.2a1.4 1.4 0 0 1-1.4-1.4V5.4A1.4 1.4 0 0 1 4.2 4h2.4"></path>',
  },
  "i-filter": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M2.6 3.4h10.8L9.2 8.2v4.2l-2.4 1.4V8.2Z"></path>',
  },
  "i-download": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M8 2.6v7.6"></path><path d="m5 7.4 3 3 3-3"></path><path d="M2.8 13h10.4"></path>',
  },
  "i-refresh": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M13.2 8a5.2 5.2 0 1 1-1.7-3.8"></path><path d="M13.4 2.4v3.4H10"></path>',
  },
  "i-play": {
    viewBox: "0 0 16 16",
    fill: "currentColor",
    stroke: "none",
    d: '<path d="M5.6 3.4 12 8l-6.4 4.6Z"></path>',
  },
  "i-message": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M13.4 9.6a1.6 1.6 0 0 1-1.6 1.6H5.6L2.6 14V4a1.6 1.6 0 0 1 1.6-1.6h7.6A1.6 1.6 0 0 1 13.4 4Z"></path>',
  },
  "i-coin": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<circle cx="8" cy="8" r="6"></circle><path d="M9.8 6.1a2.1 2.1 0 0 0-3.4 1.1c0 1.8 3.3 1 3.3 2.6a2.1 2.1 0 0 1-3.4 1"></path><path d="M8 4.4v7.2"></path>',
  },
  "i-plus": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M8 3.4v9.2"></path><path d="M3.4 8h9.2"></path>',
  },
  "i-chart": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: '<path d="M2.6 2.8v10.6h10.8"></path><path d="M5.6 13.4V9.2"></path><path d="M8.4 13.4V6"></path><path d="M11.2 13.4v-2.8"></path>',
  },
  "i-google-color": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    d: '<path fill="#EA4335" stroke="none" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" stroke="none" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" stroke="none" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" stroke="none" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>',
  },
  "i-google": {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    d: '<path fill="currentColor" stroke="none" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="currentColor" stroke="none" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="currentColor" stroke="none" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="currentColor" stroke="none" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>',
  },
};

/** The sprite. Renders nothing visible; mount it once, near the root. */
export function IconSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
    >
      <defs>
        {Object.entries(ICONS).map(([name, icon]) => {
          const { d, ...attrs } = icon;
          return (
            <symbol
              key={name}
              id={name}
              {...attrs}
              dangerouslySetInnerHTML={{ __html: d }}
            />
          );
        })}
      </defs>
    </svg>
  );
}

/**
 * One icon. `size` matches the design's usage (15px in nav rows, 14px in
 * buttons, 16px in headers); pass a number where a screen calls for something
 * else.
 *
 * Decorative by default. Pass `title` when the icon is the only thing carrying
 * meaning, which turns it into a labelled `img` for assistive tech.
 */
export function Icon({
  name,
  size = 14,
  title,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0, ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <use href={`#${name}`} />
    </svg>
  );
}
