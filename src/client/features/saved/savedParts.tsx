import { useState, type CSSProperties } from "react";

type FocusTargetEvent = {
  currentTarget: { matches: (selectors: string) => boolean };
};

/**
 * Furniture shared by the saved-keywords screen.
 *
 * The design ships no CSS classes — every rule is an inline declaration against
 * the tokens — and this screen may not add rules to the shared stylesheet, so
 * states that would normally be `:hover` / `:focus-visible` are carried as
 * component state instead.
 *
 * `var(--pad,24px)` and `var(--rp,5px)` keep their literal fallbacks: the shell
 * sets both, and the fallback is what keeps a cell sane outside it.
 */

export const SCROLLER: CSSProperties = { overflowX: "auto", maxWidth: "100%" };

/** The min-width is what makes the scroller engage instead of squashing cells. */
export const TABLE: CSSProperties = {
  width: "100%",
  minWidth: 940,
  borderCollapse: "collapse",
  fontSize: 12.5,
};

export const HEAD_ROW: CSSProperties = {
  background: "var(--subtle)",
  borderBottom: "1px solid var(--line)",
};

export const TH: CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  whiteSpace: "nowrap",
};

export const TH_RIGHT: CSSProperties = { ...TH, textAlign: "right" };

export const TD: CSSProperties = { padding: "var(--rp, 5px) 10px" };

export const TD_NUM: CSSProperties = {
  ...TD,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.01em",
};

export const ROW_LINE = "1px solid var(--border-muted)";

/** Inputs and selects across the filter panel and the pagination footer. */
export const FIELD: CSSProperties = {
  minHeight: 26,
  padding: "3px 7px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 12,
  outline: "none",
};

export const FIELD_LABEL: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: 5,
};

/**
 * Visually hidden, but kept in flow. Tailwind's `sr-only` is absolutely
 * positioned, which escapes a table's overflow-x scroller and widens the page.
 */
export const SR_ONLY: CSSProperties = {
  display: "inline-block",
  width: 1,
  height: 1,
  overflow: "hidden",
  whiteSpace: "nowrap",
};

/**
 * The design declares no focus ring anywhere, and a keyboard user needs one.
 * `:focus-visible` cannot be expressed inline, so it is matched here to keep
 * the ring off a plain mouse click.
 */
export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return {
    focusRing: focused ? "var(--focus)" : undefined,
    focusProps: {
      // Typed structurally rather than as FocusEvent<HTMLElement>: the worker
      // type set redeclares `Element`, so a DOM-element-keyed handler will not
      // fit an input, a button and a select at the same time.
      onFocus: (event: FocusTargetEvent) =>
        setFocused(event.currentTarget.matches(":focus-visible")),
      onBlur: () => setFocused(false),
    },
  };
}

/** Placeholder bar used by every skeleton on this screen. */
export function SkeletonBar({
  width,
  height = 10,
  alignRight,
}: {
  width: number | string;
  height?: number;
  alignRight?: boolean;
}) {
  return (
    <div
      style={{
        height,
        width,
        maxWidth: "100%",
        marginLeft: alignRight ? "auto" : undefined,
        borderRadius: 999,
        background: "var(--inset)",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

/** Token-styled checkbox. The design has no form controls of its own. */
export function Checkbox({
  checked,
  indeterminate,
  label,
  onClick,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
  onChange: (checked: boolean) => void;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(node) => {
        if (node) node.indeterminate = indeterminate === true && !checked;
      }}
      onClick={onClick}
      onChange={(event) => onChange(event.target.checked)}
      {...focusProps}
      style={{
        width: 14,
        height: 14,
        margin: 0,
        accentColor: "var(--accent)",
        cursor: "pointer",
        outline: "none",
        borderRadius: 3,
        boxShadow: focusRing,
      }}
    />
  );
}

/** Short honest line used where a measurement does not exist. */
export function UnavailableNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "9px 12px",
        fontSize: 12,
        color: "var(--text-3)",
        borderTop: ROW_LINE,
      }}
    >
      {children}
    </p>
  );
}
