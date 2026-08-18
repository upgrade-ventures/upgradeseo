import type { CSSProperties } from "react";

/**
 * The design's table language, for tables built on the shared TanStack wrapper.
 *
 * Feature screens that hand-roll their table markup keep their own copies of
 * these declarations next to the markup they style; this file is the copy the
 * shared `AppDataTable` and its bulk bar read, so a generic table looks like the
 * hand-rolled ones without importing out of a feature.
 *
 * `var(--pad, 24px)` and `var(--rp, 5px)` keep their literal fallbacks: the
 * shell sets both, and the fallback is what keeps a cell sane if the table is
 * ever rendered outside it.
 */

/** Tables scroll inside their own box so the page never scrolls sideways. */
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

export const TH: CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

export const TD: CSSProperties = { padding: "var(--rp, 5px) 8px" };

export const BODY_ROW: CSSProperties = {
  borderBottom: "1px solid var(--border-muted)",
};

export const ROW_HOVER: CSSProperties = { background: "var(--subtle)" };

/** Selected row: the accent tint plus a 2px bar down the leading edge. */
export const ROW_SELECTED: CSSProperties = {
  background: "var(--accent-soft)",
  boxShadow: "inset 2px 0 0 var(--accent)",
};

/** The band that appears directly above a table while rows are selected. */
export const SELECTION_BAND: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px var(--pad, 24px)",
  background: "var(--accent-soft)",
  borderBottom: "1px solid var(--accent-border)",
  flexWrap: "wrap",
};
