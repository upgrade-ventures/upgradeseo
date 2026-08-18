import * as React from "react";

/**
 * The rank screen's shared table language.
 *
 * The design ships no CSS classes — every rule is an inline declaration against
 * the tokens — and this screen may not add rules to the shared stylesheet. So
 * the values the four tabs share live here once, and hover/focus states that
 * would normally be `:hover` / `:focus-visible` are carried as component state.
 *
 * `var(--pad,24px)` and `var(--rp,5px)` keep their literal fallbacks: the shell
 * sets both, and the fallback is what keeps a cell sane if it is ever rendered
 * outside it.
 */

export const TABLE_SCROLLER: React.CSSProperties = {
  overflowX: "auto",
  maxWidth: "100%",
};

export const TABLE: React.CSSProperties = {
  width: "100%",
  minWidth: 560,
  borderCollapse: "collapse",
  fontSize: 12.5,
};

export const HEAD_ROW: React.CSSProperties = {
  background: "var(--subtle)",
  borderBottom: "1px solid var(--line)",
};

export const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

export const TH_RIGHT: React.CSSProperties = { ...TH, textAlign: "right" };

/** First column of the history and competitor tables, at the page gutter. */
export const TH_GUTTER: React.CSSProperties = {
  ...TH,
  padding: "6px var(--pad,24px)",
};

/** Value columns of the history and competitor tables. */
export const TH_VALUE: React.CSSProperties = {
  ...TH,
  textAlign: "right",
  padding: "6px 12px",
};

export const TD: React.CSSProperties = { padding: "var(--rp,5px) 8px" };

export const TD_NUM: React.CSSProperties = {
  padding: "var(--rp,5px) 8px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: ".01em",
  color: "var(--text-2)",
};

export const TD_GUTTER: React.CSSProperties = {
  padding: "var(--rp,5px) var(--pad,24px)",
  textAlign: "left",
  fontWeight: 600,
};

export const TD_VALUE: React.CSSProperties = {
  padding: "var(--rp,5px) 12px",
  textAlign: "right",
  color: "var(--text-2)",
};

/**
 * Hover and keyboard-focus state for a control the design draws inline.
 *
 * The ring is raised only for `:focus-visible`, so clicking a chip does not
 * leave a ring behind while a Tab press still lands somewhere visible.
 */
export function useInteractive() {
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  return {
    hovered,
    focused,
    interactiveProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      },
      onBlur: () => setFocused(false),
    },
  };
}

/** Pill toggle used by the views bar and the device switch. */
export function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { hovered, focused, interactiveProps } = useInteractive();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      {...interactiveProps}
      style={{
        minHeight: 24,
        padding: "2px 9px",
        border: `1px solid ${
          active
            ? "var(--accent-border)"
            : hovered
              ? "var(--border-strong)"
              : "var(--line)"
        }`,
        background: active ? "var(--accent-soft)" : "var(--surface)",
        color: active ? "var(--accent)" : "var(--text-2)",
        fontWeight: active ? 600 : 400,
        borderRadius: 999,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: "pointer",
        whiteSpace: "nowrap",
        outline: "none",
        boxShadow: focused ? "var(--focus)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

/** 24px action button used inside the bands (selection bar, views bar). */
export function SmallButton({
  tone = "neutral",
  onClick,
  disabled,
  title,
  style,
  children,
  // Spread onto the element so an icon-only caller can name it and a
  // disclosure can say whether it is open. Hyphenated JSX attributes are not
  // type-checked, so an explicit prop list would drop these in silence.
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "neutral" | "danger" | "ghost";
}) {
  const { hovered, focused, interactiveProps } = useInteractive();
  const tones: Record<string, React.CSSProperties> = {
    neutral: {
      border: `1px solid ${hovered && !disabled ? "var(--border-strong)" : "var(--line)"}`,
      background: "var(--surface)",
      color: "var(--text)",
    },
    danger: {
      border: "1px solid var(--danger-border)",
      background: "var(--danger-soft)",
      color: "var(--danger)",
      fontWeight: 600,
    },
    ghost: {
      border: "none",
      background: "none",
      color: hovered && !disabled ? "var(--text)" : "var(--text-2)",
    },
  };
  return (
    <button
      type="button"
      {...rest}
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...interactiveProps}
      style={{
        minHeight: 24,
        padding: "2px 9px",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.55 : 1,
        outline: "none",
        boxShadow: focused ? "var(--focus)" : undefined,
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Body row for every rank table.
 *
 * Three row states, in the order they outrank each other: `selected` is the
 * design's accent tint plus a 2px bar on the leading edge, `highlight` is the
 * J/K cursor, and hover is only where the pointer happens to be. Selection wins
 * because it is the state the bulk bar is about to act on.
 */
export function HoverRow({
  highlight,
  selected,
  style,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & {
  highlight?: boolean;
  selected?: boolean;
  ref?: React.Ref<HTMLTableRowElement>;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <tr
      {...rest}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: "1px solid var(--border-muted)",
        ...(selected
          ? {
              background: "var(--accent-soft)",
              boxShadow: "inset 2px 0 0 var(--accent)",
            }
          : {
              background: highlight
                ? "var(--inset)"
                : hovered
                  ? "var(--subtle)"
                  : undefined,
            }),
        ...style,
      }}
    >
      {children}
    </tr>
  );
}

/** The design's dotted note. `align="top"` is the history-tab variant. */
export function InfoDotNote({
  align = "center",
  tone = "info",
  style,
  children,
}: {
  align?: "center" | "top";
  tone?: "info" | "danger";
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: align === "center" ? "center" : undefined,
        gap: align === "center" ? 10 : 9,
        padding: "9px 12px",
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--subtle)",
        fontSize: 12.5,
        color: "var(--text-2)",
        ...style,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: tone === "danger" ? "var(--danger)" : "var(--info)",
          flexShrink: 0,
          marginTop: align === "top" ? 5 : undefined,
        }}
      />
      <span>{children}</span>
    </div>
  );
}

/** Empty / error / not-measured message in place of a table body. */
export function StateBand({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "34px var(--pad,24px)",
        textAlign: "center",
        fontSize: 12.5,
        color: "var(--text-2)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div>{children}</div>
      {action ? (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

/** Loading placeholder. Uses the design's own `shimmer` keyframes. */
export function Skeleton({
  width,
  height = 11,
  style,
}: {
  width: number | string;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width,
        height,
        borderRadius: 4,
        background: "var(--inset)",
        animation: "shimmer 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/** Spinning ring. 9px inside a pill, 11px inside the primary button. */
export function Spinner({
  size,
  color = "var(--info)",
}: {
  size: number;
  color?: string;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        animation: "spin 1s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

/** The design's "no value here" glyph. */
export function Dash({ muted = true }: { muted?: boolean }) {
  return (
    <span style={{ color: muted ? "var(--text-3)" : "var(--text-2)" }}>—</span>
  );
}
