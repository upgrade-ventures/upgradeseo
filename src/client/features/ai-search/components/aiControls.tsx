import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";

/**
 * The controls the AI Visibility screen draws that the shared Prominence
 * primitives do not cover: the design's control-row input and select, the
 * mention dot-pill, the two tables' head cells, and the states (skeleton,
 * error, empty) the design never draws.
 *
 * The design specifies no focus state anywhere on this screen. Every control
 * here adds the token focus ring from React state rather than a
 * `:focus-visible` rule, because screens must not add shared CSS.
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

/**
 * `onAnyFocus` rings on a mouse focus too, which is what a text field wants:
 * clicking into an input should show where the caret went. Buttons and chips
 * ring on keyboard focus only.
 */
export function useFocusRing(onAnyFocus = false) {
  const [ringed, setRinged] = useState(false);

  return {
    ring: ringed
      ? ({ boxShadow: "var(--focus)", outline: "none" } as CSSProperties)
      : null,
    ringProps: {
      onFocus: (event: { currentTarget: EventTarget }) =>
        setRinged(onAnyFocus || isKeyboardFocus(event.currentTarget)),
      onBlur: () => setRinged(false),
    },
  };
}

/** Native select of the design's control row. */
export function ControlSelect({
  style,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const { ring, ringProps } = useFocusRing(true);

  return (
    <select
      {...rest}
      {...ringProps}
      style={{
        minHeight: 30,
        padding: "5px 8px",
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--surface)",
        color: "var(--text)",
        fontFamily: "inherit",
        fontSize: 12.5,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        ...(rest.disabled ? { opacity: 0.55 } : null),
        ...ring,
        ...style,
      }}
    >
      {children}
    </select>
  );
}

/**
 * The answer card's rank chip, reused as a toggle for the model selection.
 * `active` carries the design's own-brand treatment.
 */
export function Chip({
  active = false,
  style,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { ring, ringProps } = useFocusRing();

  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      {...ringProps}
      // A 22px pill is under the 44px touch floor, and chips are the only way
      // to pick a model. A media query cannot be written inline.
      className="max-sm:min-h-11"
      style={{
        fontSize: 11.5,
        borderRadius: 999,
        padding: "1px 8px",
        minHeight: 22,
        fontFamily: "inherit",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        ...(active
          ? {
              border: "1px solid var(--accent-border)",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              fontWeight: 600,
            }
          : {
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--text-2)",
            }),
        ...(rest.disabled ? { opacity: 0.55 } : null),
        ...ring,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Static version of the chip above, for values the reader cannot toggle. */
export function StaticChip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        borderRadius: 999,
        padding: "1px 8px",
        border: "1px solid var(--line)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * The "You" column pill: a dot in currentColor plus a label. Success when the
 * brand was named, muted when it was not.
 */
export function MentionPill({
  tone,
  children,
}: {
  tone: "mentioned" | "absent";
  children: ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        color: tone === "mentioned" ? "var(--success)" : "var(--text-3)",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: "currentColor",
        }}
      />
      {children}
    </span>
  );
}

/**
 * The design's submit button in both of its states. The running variant is 2px
 * shorter than the idle one and carries a ring spinner; both differences are
 * written into the design and are reproduced rather than smoothed out.
 */
export function RunButton({
  running,
  idleLabel,
  runningLabel,
  disabled,
}: {
  running: boolean;
  idleLabel: string;
  runningLabel: string;
  disabled?: boolean;
}) {
  const { ring, ringProps } = useFocusRing();

  if (running) {
    return (
      <button
        type="submit"
        disabled
        // The accent button's fill, border and label colour live in the shared
        // rule rather than being restated as literals here; the design's
        // The accent button's label colour is written down once, there.
        className="prominence-button-primary max-sm:min-h-11"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          cursor: "progress",
          opacity: 0.9,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 11,
            height: 11,
            borderRadius: 999,
            // currentColor is the button's own label colour, so the spinner
            // never needs its own literal.
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            animation: "spin 1s linear infinite",
          }}
        />
        {runningLabel}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={disabled}
      {...ringProps}
      className="prominence-button-primary max-sm:min-h-11"
      // The design's idle button is 2px taller than its running one. Both
      // differences are written into the design and reproduced rather than
      // smoothed out.
      style={{ minHeight: 30, padding: "5px 12px", ...ring }}
    >
      {idleLabel}
    </button>
  );
}

/* ── States the design never draws ────────────────────────────────────────── */

export function SkeletonBar({
  width,
  height = 12,
}: {
  width: number | string;
  height?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius: 4,
        background: "var(--inset)",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "9px 12px",
        border: "1px solid var(--danger-border)",
        borderRadius: 8,
        background: "var(--danger-soft)",
        color: "var(--danger)",
        fontSize: 12.5,
      }}
    >
      <span>{message}</span>
      {onRetry ? (
        <SecondaryButton icon="i-refresh" onClick={onRetry}>
          Try again
        </SecondaryButton>
      ) : null}
    </div>
  );
}

/** The design's dot callout, used for every "what this number is not" note. */
export function InfoCallout({
  tone = "info",
  gutter = true,
  children,
}: {
  tone?: "info" | "warning";
  /** False when the callout sits inside a card that already has padding. */
  gutter?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        margin: gutter ? "14px var(--pad, 24px)" : 0,
        padding: "9px 12px",
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--subtle)",
        fontSize: 12.5,
        color: "var(--text-2)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: tone === "warning" ? "var(--warning)" : "var(--info)",
          flexShrink: 0,
          marginTop: 5,
        }}
      />
      <span>{children}</span>
    </div>
  );
}

/** Absolute times are noise for a measurement taken seconds ago. */
export function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";

  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}
