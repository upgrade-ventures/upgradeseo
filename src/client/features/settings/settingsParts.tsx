import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Furniture shared by the Settings screen.
 *
 * The design ships no CSS classes: every rule is an inline declaration against
 * the tokens, and this screen may not add rules to the shared stylesheet, so
 * `:hover` and `:focus-visible` are carried as component state instead.
 *
 * The design's base border colour is `--border`; DaisyUI owns that name for a
 * width in this repo, so the colour is `--line` everywhere below.
 */

/** Uppercase eyebrow used by Appearance, Analytics and About. */
export const EYEBROW: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

/** Larger section heading used by Sites and Data provider keys. */
export const SECTION_TITLE: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
};

export const SECTION_LEDE: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 12.5,
  color: "var(--text-2)",
};

export const ROW_LINE = "1px solid var(--border-muted)";

/** Bordered, rounded container that clips its rows. */
export const LIST_BOX: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 8,
  overflow: "hidden",
};

/** Label/value pair inside an expanded provider key. */
export const META_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
  gap: 10,
};

export const META_LABEL: CSSProperties = {
  fontSize: 11.5,
  color: "var(--text-2)",
};

export type DotTone = "success" | "warning" | "danger" | "muted";

const DOT_COLOR: Record<DotTone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  muted: "var(--text-3)",
};

/** The design's 7px status dot. */
export function StatusDot({
  tone,
  size = 7,
}: {
  tone: DotTone;
  size?: number;
}) {
  return (
    <span
      style={{
        // block, not the span default: an inline box ignores width and height,
        // and this dot is not always a flex item.
        display: "block",
        width: size,
        height: size,
        borderRadius: 999,
        background: DOT_COLOR[tone],
        flexShrink: 0,
      }}
    />
  );
}

/**
 * The design declares no focus ring anywhere, and a keyboard user needs one.
 * `:focus-visible` cannot be expressed inline, so it is matched here to keep
 * the ring off a plain mouse click.
 */
type FocusMatchable = { matches: (selectors: string) => boolean };

export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return {
    focusRing: focused ? "var(--focus)" : undefined,
    focusProps: {
      // Typed by what the handler actually touches rather than by an element
      // class: `FocusEvent<HTMLElement>` does not accept a <select> under
      // React's event generics, and this screen focuses both.
      onFocus: (event: { currentTarget: FocusMatchable }) =>
        setFocused(event.currentTarget.matches(":focus-visible")),
      onBlur: () => setFocused(false),
    },
  };
}

/** Placeholder bar used by every skeleton on this screen. */
export function SkeletonBar({
  width,
  height = 10,
}: {
  width: number | string;
  height?: number;
}) {
  return (
    <div
      style={{
        height,
        width,
        maxWidth: "100%",
        borderRadius: 999,
        background: "var(--inset)",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

/** Short honest line used where something is missing, failed or unmeasured. */
export function QuietNote({
  children,
  tone = "quiet",
  style,
}: {
  children: ReactNode;
  tone?: "quiet" | "danger";
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        margin: "8px 0 0",
        fontSize: 12,
        color: tone === "danger" ? "var(--danger)" : "var(--text-3)",
        ...style,
      }}
      role={tone === "danger" ? "alert" : undefined}
    >
      {children}
    </p>
  );
}

/**
 * Danger-toned button. `solid` is the armed state the design swaps in once a
 * typed confirmation matches; disabled keeps the design's muted, not-allowed
 * skin instead of the primitives' translucent one.
 */
export function DangerButton({
  solid,
  disabled,
  onClick,
  children,
}: {
  solid?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      {...focusProps}
      style={{
        minHeight: 28,
        padding: "4px 11px",
        borderRadius: 6,
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        outline: "none",
        boxShadow: focusRing,
        border: disabled
          ? "1px solid var(--border-muted)"
          : `1px solid var(--danger${solid ? "" : "-border"})`,
        background: disabled
          ? "var(--surface)"
          : solid
            ? "var(--danger)"
            : "var(--danger-soft)",
        color: disabled
          ? "var(--text-3)"
          : solid
            ? "var(--text-inv)"
            : "var(--danger)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Tinted inline callout. Used for warnings the user must read before acting. */
export function Callout({
  tone,
  children,
  style,
}: {
  tone: "warning" | "info" | "danger";
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "9px 11px",
        border: `1px solid var(--${tone}-border)`,
        background: `var(--${tone}-soft)`,
        borderRadius: 6,
        fontSize: 12.5,
        color: "var(--text-2)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** "14 March 2026", the date format the design uses for stored records. */
export function formatDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Two-letter monogram for a site badge. */
export function monogram(label: string): string {
  const letters = label.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "");
  return (letters.slice(0, 2) || "??").toUpperCase();
}
