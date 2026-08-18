import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Icon } from "@/client/components/icons/IconSprite";

/**
 * The controls the onboarding screen draws that the shared Prominence
 * primitives do not cover: the 24px ghost buttons ("Change", "Reset this
 * walkthrough"), the 12px form buttons in the domain editor, the text fields,
 * and the small status panels.
 *
 * The design specifies no focus and no hover state anywhere on this screen.
 * Both are added here from React state rather than CSS rules, because a screen
 * must not write to the shared stylesheet.
 */

/**
 * Structural rather than typed against HTMLElement: the worker DOM types this
 * project compiles against redeclare members on some elements, so one handler
 * typed against a concrete element will not accept every control's focus event.
 */
type MatchTarget = { matches?: (selector: string) => boolean };

function isKeyboardFocus(target: MatchTarget): boolean {
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
      onFocus: (event: { currentTarget: MatchTarget }) =>
        setRinged(isKeyboardFocus(event.currentTarget)),
      onBlur: () => setRinged(false),
    },
  };
}

type MiniButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "quiet";
  /** `sm` is the design's 24px ghost row; `md` its 28px form row. */
  size?: "sm" | "md";
};

/** The design's smaller buttons: Change, Save, Cancel, Reset this walkthrough. */
export function MiniButton({
  tone = "secondary",
  size = "md",
  style,
  className,
  children,
  ...rest
}: MiniButtonProps) {
  const { ring, ringProps } = useFocusRing();
  const [hover, setHover] = useState(false);
  const palette: CSSProperties =
    tone === "primary"
      ? {
          border: "1px solid var(--accent)",
          background: "var(--accent)",
          // --text-inv, not #fff: white on the dark-mode accent is 2.57:1.
          // stays white on the lighter dark-mode accent.
          color: "var(--text-inv)",
          fontWeight: 600,
        }
      : {
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: tone === "quiet" ? "var(--text-3)" : "var(--text-2)",
        };
  const hovered = hover && !rest.disabled;

  return (
    <button
      type="button"
      {...rest}
      {...ringProps}
      // The design's 24/28px rows are below the 44px touch floor, and a
      // media query cannot be written inline.
      className={`max-sm:min-h-11 ${className ?? ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minHeight: size === "sm" ? 24 : 28,
        padding: size === "sm" ? "2px 9px" : "4px 10px",
        borderRadius: 6,
        fontSize: size === "sm" ? 11.5 : 12,
        fontFamily: "inherit",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: rest.disabled ? 0.55 : 1,
        ...palette,
        ...(hovered
          ? tone === "primary"
            ? { filter: "brightness(1.08)" }
            : { borderColor: "var(--border-strong)" }
          : null),
        ...style,
        ...ring,
      }}
    >
      {children}
    </button>
  );
}

/**
 * The design's inline links ("Do it now"). Drawn as a button, not an anchor:
 * the design's anchors carry no href, which leaves them unreachable by
 * keyboard.
 */
export function LinkButton({
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { ring, ringProps } = useFocusRing();
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      {...rest}
      {...ringProps}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: "none",
        background: "none",
        padding: 0,
        borderRadius: 4,
        fontFamily: "inherit",
        fontSize: 12,
        color: "var(--accent)",
        cursor: "pointer",
        textDecoration: hover ? "underline" : "none",
        ...style,
        ...ring,
      }}
    >
      {children}
    </button>
  );
}

const FIELD_STYLE: CSSProperties = {
  minHeight: 28,
  padding: "4px 9px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 12.5,
};

export function TextInput({
  style,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  const { ring, ringProps } = useFocusRing();

  return (
    <input
      type="text"
      {...rest}
      {...ringProps}
      className={`max-sm:min-h-11 ${className ?? ""}`}
      style={{ ...FIELD_STYLE, ...style, ...ring }}
    />
  );
}

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ display: "block", fontSize: 12, fontWeight: 600 }}
    >
      {children}
    </label>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ fontSize: 11.5, color: "var(--text-2)", margin: "2px 0 5px" }}
    >
      {children}
    </div>
  );
}

/** Ring spinner, on the design's own `spin` keyframes. */
function Spinner({ size = 12 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: "2px solid var(--info)",
        borderTopColor: "transparent",
        animation: "spin 1s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

/** Loading placeholder, on the design's own `shimmer` keyframes. */
export function Skeleton({
  width,
  height = 11,
  style,
}: {
  width: number | string;
  height?: number;
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

/** The info-tinted panel the design shows while a step waits on Google. */
export function WorkingPanel({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        marginTop: 7,
        padding: "9px 11px",
        border: "1px solid var(--info-border)",
        background: "var(--info-soft)",
        borderRadius: 6,
        maxWidth: 340,
      }}
    >
      <Spinner />
      <div style={{ fontSize: 12.5 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ color: "var(--text-2)" }}>{children}</div>
      </div>
    </div>
  );
}

/** A failed lookup or save. The design specifies no error state anywhere. */
export function ErrorLine({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 7,
        fontSize: 12,
        color: "var(--danger)",
      }}
    >
      <Icon name="i-alert" size={12} />
      <span>{children}</span>
      {onRetry ? <LinkButton onClick={onRetry}>Try again</LinkButton> : null}
    </div>
  );
}
