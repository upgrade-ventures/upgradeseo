import { useState, type CSSProperties, type FocusEvent } from "react";

/**
 * The audit screen's design declarations, written down once.
 *
 * The design has no classes: every rule is an inline style against the token
 * set, and the same row/cell/eyebrow recipe is repeated on every element. They
 * live here so a panel reads as structure, and so a value the design uses in
 * nine places is written once.
 *
 * `--pad` is the shell's page gutter (24px, 14px when narrow) and `--rp` its
 * table row padding (5px); both come from the shell root, so these recipes
 * re-gutter themselves without a media query.
 */

/** Trailing scroll space under the last panel. */
export const SCREEN_WRAP: CSSProperties = { paddingBottom: 48 };

/* ── Full-bleed bands ─────────────────────────────────────────────────────── */

/** The issues summary strip: four cells that reflow at 170px each. */
export const SUMMARY_STRIP: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  borderBottom: "1px solid var(--line)",
};

export const SUMMARY_CELL: CSSProperties = {
  padding: "13px 20px",
  borderRight: "1px solid var(--border-muted)",
};

/** Last cell in the strip: no divider on its right edge. */
export const SUMMARY_CELL_LAST: CSSProperties = { padding: "13px 20px" };

export const SUMMARY_LABEL: CSSProperties = {
  fontSize: 11.5,
  color: "var(--text-2)",
};

export const SUMMARY_VALUE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
};

export const SUMMARY_NUMBER: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.01em",
  fontSize: 22,
  fontWeight: 700,
};

export const SUMMARY_CAPTION: CSSProperties = {
  fontSize: 12,
  color: "var(--text-3)",
};

/** Filter bar sitting on `--subtle` directly under the summary strip. */
export const FILTER_BAR: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px var(--pad, 24px)",
  borderBottom: "1px solid var(--line)",
  background: "var(--subtle)",
  flexWrap: "wrap",
};

export const FILTER_HINT: CSSProperties = {
  marginLeft: "auto",
  fontSize: 12,
  color: "var(--text-2)",
};

/** Uppercase eyebrow above a severity group. */
export const SEVERITY_EYEBROW: CSSProperties = {
  padding: "14px var(--pad, 24px) 0",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

/** One issue type. The last row in the list drops the bottom border. */
export const LIST_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "9px var(--pad, 24px)",
  borderBottom: "1px solid var(--border-muted)",
};

export const ROW_DOT: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
};

export const ROW_TITLE: CSSProperties = { fontSize: 13, fontWeight: 600 };

export const ROW_DESCRIPTION: CSSProperties = {
  fontSize: 12,
  color: "var(--text-2)",
};

/** Right-aligned count column, fixed width so the chevrons line up. */
export const ROW_COUNT: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.01em",
  fontSize: 12,
  width: 70,
  textAlign: "right",
  flexShrink: 0,
};

/** The Performance and Crawl history panels are narrower than the full bleed. */
export const NARROW_PANEL: CSSProperties = {
  padding: "16px var(--pad, 24px)",
  maxWidth: 820,
};

/* ── Tables ───────────────────────────────────────────────────────────────── */

export const TABLE_SCROLL: CSSProperties = {
  overflowX: "auto",
  maxWidth: "100%",
};

export const DATA_TABLE: CSSProperties = {
  width: "100%",
  minWidth: 560,
  borderCollapse: "collapse",
  fontSize: 12.5,
};

export const HEAD_ROW: CSSProperties = {
  background: "var(--subtle)",
  borderBottom: "1px solid var(--line)",
};

const HEAD_CELL: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-3)",
  whiteSpace: "nowrap",
};

/** First head cell: left aligned, left edge on the page gutter. */
export const TH_LEAD: CSSProperties = {
  ...HEAD_CELL,
  textAlign: "left",
  padding: "6px var(--pad, 24px)",
};

/** Every other head cell on this screen: right aligned. */
export const TH_NUMERIC: CSSProperties = {
  ...HEAD_CELL,
  textAlign: "right",
  padding: "6px 12px",
};

export const BODY_ROW: CSSProperties = {
  borderBottom: "1px solid var(--border-muted)",
};

export const TD_LEAD: CSSProperties = {
  padding: "var(--rp, 5px) var(--pad, 24px)",
  textAlign: "left",
  fontWeight: 600,
};

export const TD_VALUE: CSSProperties = {
  padding: "var(--rp, 5px) 12px",
  textAlign: "right",
  color: "var(--text-2)",
  // Every value column on this screen is a figure, and figures only line up
  // column-wise when the digits are all one width.
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.01em",
};

/* ── Colour rules ─────────────────────────────────────────────────────────── */

/**
 * Severity colour. `info` is the design's "notice" level, which it draws in
 * `--text-3` rather than a hue of its own.
 */
export function severityColor(severity: "critical" | "warning" | "info") {
  if (severity === "critical") return "var(--danger)";
  if (severity === "warning") return "var(--warning)";
  return "var(--text-3)";
}

/**
 * Lighthouse score colour.
 *
 * The design states no rule, only drawn values (41 danger; 58/72/74 warning;
 * 92/94/96 success). Google's own published bands sit exactly between them, so
 * those are used rather than a threshold invented to fit three samples.
 */
export function scoreColor(score: number) {
  if (score >= 90) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--danger)";
}

/* ── Interaction ──────────────────────────────────────────────────────────── */

/**
 * Row hover for tables.
 *
 * The design carries hover as a `style-hover` attribute, which wants a real
 * `tbody tr:hover` rule; app.css is shared and off limits here, so the
 * background is written straight to the node. Deliberately not React state:
 * hovering must not re-render a thousand-row table.
 */
export const rowHoverHandlers = {
  onMouseEnter: (event: { currentTarget: HTMLElement }) => {
    event.currentTarget.style.background = "var(--subtle)";
  },
  onMouseLeave: (event: { currentTarget: HTMLElement }) => {
    event.currentTarget.style.background = "";
  },
};

/**
 * Hover state for a single control that also has other background states
 * (selected, expanded), where writing straight to the node would fight them.
 */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    hoverProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  };
}

/**
 * Keyboard focus ring.
 *
 * The design specifies no focus state anywhere on this screen, which leaves
 * keyboard users with nothing once a control suppresses the UA outline.
 * `--focus` is the token for it and belongs in a `:focus-visible` rule; app.css
 * is shared, so it is applied here and reported for promotion to real CSS.
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
