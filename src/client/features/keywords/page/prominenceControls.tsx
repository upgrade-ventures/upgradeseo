import { useState, type ButtonHTMLAttributes, type CSSProperties } from "react";

/**
 * The controls this screen draws that the shared Prominence primitives do not
 * cover: the saved-view pills and filter chips, the small outline buttons in
 * the selection bar, and the pager. Each carries the design's own declarations.
 *
 * The design specifies no focus state anywhere on this screen. Every control
 * here adds the token focus ring, driven from React state rather than a
 * `:focus-visible` rule because screens must not add shared CSS.
 *
 * Every min-height is floored against `--tap`, which the screen root sets to
 * 44px under the narrow breakpoint and 0 otherwise. That is how the mobile
 * hit-target floor is met without inflating the design's compact desktop
 * heights and without a media query in shared CSS.
 */

/**
 * Typed on EventTarget rather than on the element: the worker DOM types this
 * project compiles against redeclare `remove()` on some elements, so a handler
 * typed against HTMLElement will not accept a select's focus event.
 */
function isKeyboardFocus(target: EventTarget): boolean {
  // Narrow rather than assert: EventTarget covers nodes that have no matches().
  if (!(target instanceof Element)) return false;
  // Engines without :focus-visible throw on the unknown pseudo-class.
  try {
    return target.matches?.(":focus-visible") ?? false;
  } catch {
    return false;
  }
}

export function useFocusRing() {
  const [ringed, setRinged] = useState(false);

  return {
    ring: ringed
      ? ({ boxShadow: "var(--focus)", outline: "none" } as CSSProperties)
      : null,
    ringProps: {
      onFocus: (event: { currentTarget: EventTarget }) =>
        setRinged(isKeyboardFocus(event.currentTarget)),
      onBlur: () => setRinged(false),
    },
  };
}

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `pill` is a saved view (999px), `chip` a filter toggle (6px). */
  shape: "pill" | "chip";
  active?: boolean;
  /** The "+ Filter" affordance, which carries no on/off state. */
  dashed?: boolean;
};

export function Chip({
  shape,
  active = false,
  dashed = false,
  style,
  children,
  ...rest
}: ChipProps) {
  const { ring, ringProps } = useFocusRing();
  const tone = dashed
    ? {
        border: "1px dashed var(--border-strong)",
        background: "transparent",
        color: "var(--text-2)",
      }
    : active
      ? {
          border: "1px solid var(--accent-border)",
          background: "var(--accent-soft)",
          color: "var(--accent)",
        }
      : {
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--text-2)",
        };

  return (
    <button
      type="button"
      {...rest}
      {...ringProps}
      style={{
        minHeight: "max(24px, var(--tap, 0px))",
        padding: "2px 9px",
        borderRadius: shape === "pill" ? 999 : 6,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        ...tone,
        ...(shape === "pill" ? { fontWeight: active ? 600 : 400 } : null),
        ...(rest.disabled ? { opacity: 0.55 } : null),
        ...ring,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** The outline button the selection bar repeats for each bulk action. */
export function BarButton({
  style,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { ring, ringProps } = useFocusRing();

  return (
    <button
      type="button"
      {...rest}
      {...ringProps}
      style={{
        minHeight: "max(24px, var(--tap, 0px))",
        padding: "2px 9px",
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--text)",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        ...(rest.disabled ? { opacity: 0.55 } : null),
        ...ring,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Borderless button, used for "Clear selection" and the back link. */
export function GhostButton({
  style,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { ring, ringProps } = useFocusRing();

  return (
    <button
      type="button"
      {...rest}
      {...ringProps}
      style={{
        minHeight: "max(24px, var(--tap, 0px))",
        padding: "2px 9px",
        border: "none",
        background: "none",
        color: "var(--text-2)",
        fontSize: 12,
        fontFamily: "inherit",
        cursor: "pointer",
        whiteSpace: "nowrap",
        borderRadius: 6,
        ...ring,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function PagerButton({
  style,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { ring, ringProps } = useFocusRing();

  return (
    <button
      type="button"
      {...rest}
      {...ringProps}
      style={{
        minHeight: "max(26px, var(--tap, 0px))",
        padding: "3px 9px",
        border: `1px solid ${rest.disabled ? "var(--border-muted)" : "var(--line)"}`,
        background: "var(--surface)",
        color: rest.disabled ? "var(--text-3)" : "var(--text)",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        ...ring,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Native select, styled to the design's search-bar control. */
export function ProminenceSelect({
  style,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { ring, ringProps } = useFocusRing();

  return (
    <select
      {...rest}
      {...ringProps}
      style={{
        minHeight: "max(30px, var(--tap, 0px))",
        padding: "5px 8px",
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--surface)",
        color: "var(--text)",
        fontFamily: "inherit",
        fontSize: 12.5,
        ...ring,
        ...style,
      }}
    >
      {children}
    </select>
  );
}

/**
 * Placeholder block for content that has not loaded. The design has no skeleton
 * for this screen; the shimmer keyframes it ships are reused here so a loading
 * table reads as pending rather than as an empty result.
 */
export function Skeleton({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number | string;
  style?: CSSProperties;
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
