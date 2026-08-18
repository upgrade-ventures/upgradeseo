import type { CSSProperties, FocusEvent, MouseEvent } from "react";

/**
 * The design's data table, written down once.
 *
 * Both tables on this screen share one shell, one head-cell recipe and one row
 * rule; the design repeats those declarations on every cell. Holding them here
 * keeps the two tables provably identical and keeps a cell in the markup down
 * to the value it renders.
 *
 * The first and last columns are padded with `--pad` (the shell's page gutter)
 * so their outer edges line up with the header band above them; every column
 * between them uses a flat 12px.
 */

export const tableScrollShell: CSSProperties = {
  overflowX: "auto",
  maxWidth: "100%",
};

export const dataTable: CSSProperties = {
  width: "100%",
  minWidth: 560,
  borderCollapse: "collapse",
  fontSize: 12.5,
};

export const headRow: CSSProperties = {
  background: "var(--subtle)",
  borderBottom: "1px solid var(--line)",
};

const headCell: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-3)",
  whiteSpace: "nowrap",
};

/** First column head: left aligned, left edge on the page gutter. */
export const thLead: CSSProperties = {
  ...headCell,
  textAlign: "left",
  padding: "6px var(--pad, 24px)",
};

/** Middle column head: right aligned numeric. */
export const thNumeric: CSSProperties = {
  ...headCell,
  textAlign: "right",
  padding: "6px 12px",
};

/** Middle column head that holds text rather than a number. */
export const thMiddle: CSSProperties = {
  ...headCell,
  textAlign: "left",
  padding: "6px 12px",
};

/** Last column head: left aligned, right edge on the page gutter. */
export const thTrail: CSSProperties = {
  ...headCell,
  textAlign: "left",
  padding: "6px var(--pad, 24px) 6px 12px",
};

export const bodyRow: CSSProperties = {
  borderBottom: "1px solid var(--border-muted)",
};

/** First body cell: emphasised, left edge on the page gutter. */
export const tdLead: CSSProperties = {
  padding: "var(--rp, 5px) var(--pad, 24px)",
  fontWeight: 600,
};

/** Checkbox gutter cell, used where a table supports selection. */
export const tdSelect: CSSProperties = {
  padding: "var(--rp, 5px) 8px var(--rp, 5px) var(--pad, 24px)",
  width: 1,
};

/** First body cell when a selection column already holds the gutter. */
export const tdLeadAfterSelect: CSSProperties = {
  padding: "var(--rp, 5px) 12px",
  fontWeight: 600,
};

/** Right-aligned figure at full text colour (the design uses this for rank). */
export const tdNumeric: CSSProperties = {
  padding: "var(--rp, 5px) 12px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.01em",
};

/** Right-aligned figure, muted. */
export const tdNumericMuted: CSSProperties = {
  ...tdNumeric,
  color: "var(--text-2)",
};

/**
 * The pages tab's numeric cells.
 *
 * The design omits `font-variant-numeric` and `letter-spacing` here, unlike the
 * identical columns on the keywords tab. Reproduced as authored; see the
 * divergence note in the report.
 */
export const tdPagesNumeric: CSSProperties = {
  padding: "var(--rp, 5px) 12px",
  textAlign: "right",
  color: "var(--text-2)",
};

/** Last body cell: muted, right edge on the page gutter. */
export const tdTrail: CSSProperties = {
  padding: "var(--rp, 5px) var(--pad, 24px) var(--rp, 5px) 12px",
  color: "var(--text-2)",
};

/**
 * Row hover.
 *
 * The design carries hover as a `style-hover` attribute, which wants a real
 * `tbody tr:hover` rule. app.css is shared and off limits for this screen, so
 * the background is written straight to the node instead of through React
 * state: hovering a row must not re-render a hundred-row table.
 */
export const rowHoverHandlers = {
  onMouseEnter: (event: MouseEvent<HTMLTableRowElement>) => {
    event.currentTarget.style.background = "var(--subtle)";
  },
  onMouseLeave: (event: MouseEvent<HTMLTableRowElement>) => {
    event.currentTarget.style.background = "";
  },
};

/**
 * Keyboard focus ring for controls this screen owns.
 *
 * The design specifies no focus state anywhere, which leaves keyboard users
 * with nothing once a control suppresses the UA outline. `--focus` is the
 * token for it; it belongs in a `:focus-visible` rule, and app.css is shared,
 * so it is applied here instead and reported for promotion to real CSS.
 */
/**
 * Constrained structurally rather than to HTMLElement: lib.dom types
 * HTMLSelectElement's overloaded `remove` in a way that fails that constraint,
 * and all this needs is a node it can measure focus on and restyle.
 */
type FocusRingTarget = {
  matches: (selectors: string) => boolean;
  style: { boxShadow: string };
};

export function focusRing<T extends FocusRingTarget>() {
  return {
    onFocus: (event: FocusEvent<T>) => {
      if (event.currentTarget.matches(":focus-visible")) {
        event.currentTarget.style.boxShadow = "var(--focus)";
      }
    },
    onBlur: (event: FocusEvent<T>) => {
      event.currentTarget.style.boxShadow = "";
    },
  };
}
