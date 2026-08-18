import { useState } from "react";
import { toast } from "sonner";

import { Icon } from "@/client/components/icons/IconSprite";

/**
 * Controls for the AI & MCP screen.
 *
 * The design ships no markup for this screen (`app-0.js` declares it, no
 * `<sc-if show.settings>` block exists), so everything here is built from the
 * token vocabulary the rest of the port uses: `--line` for borders, `--subtle`
 * for header strips, 12.5px body copy, 28px control height.
 *
 * There is no monospace anywhere in the design, so the command blocks below set
 * `font-family: inherit` explicitly, since a bare `<pre>`/`<code>` would
 * pick up the browser's monospace default through Tailwind's preflight.
 */

/**
 * The design declares no focus rule, and a keyboard user needs one.
 * `:focus-visible` cannot be expressed in an inline style, so it is matched
 * here to keep the ring off a plain mouse click.
 */
function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return {
    focusRing: focused ? "var(--focus)" : undefined,
    focusProps: {
      onFocus: (event: {
        currentTarget: { matches: (s: string) => boolean };
      }) => setFocused(event.currentTarget.matches(":focus-visible")),
      onBlur: () => setFocused(false),
    },
  };
}

/** Disclosure row. One of a stack, so it owns only its own bottom border. */
export function Collapsible({
  id,
  title,
  subtitle,
  icon,
  last,
  narrow,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  last?: boolean;
  /** Below the shell's 900px breakpoint, where hit targets grow to 44px. */
  narrow?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { focusRing, focusProps } = useFocusRing();
  const contentId = `collapsible-${id}`;

  return (
    <div style={{ borderBottom: last ? undefined : "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        {...focusProps}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: narrow ? 44 : 40,
          padding: "9px 12px",
          border: "none",
          background: hovered ? "var(--subtle)" : "none",
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
          outline: "none",
          boxShadow: focusRing,
        }}
      >
        {icon ? (
          <span
            aria-hidden
            style={{
              display: "flex",
              width: 18,
              height: 18,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text)",
            }}
          >
            {icon}
          </span>
        ) : null}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {title}
          </span>
          {subtitle ? (
            <span
              style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
        <Icon
          name="i-chev-down"
          size={13}
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 120ms ease",
          }}
        />
      </button>
      {open ? (
        <div
          id={contentId}
          style={{
            display: "grid",
            gap: 10,
            padding: "0 12px 13px",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A command to run, with its own horizontal scroll so the page never gets one. */
export function CodeBlock({
  code,
  narrow,
  onCopy,
}: {
  code: string;
  narrow?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--subtle)",
        overflow: "hidden",
      }}
    >
      <pre
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          padding: "9px 10px",
          overflowX: "auto",
          // One font family in the product. `<pre>` would otherwise inherit
          // Tailwind preflight's monospace stack.
          fontFamily: "inherit",
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "var(--text)",
        }}
      >
        {code}
      </pre>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          flexShrink: 0,
          padding: 5,
          borderLeft: "1px solid var(--line)",
        }}
      >
        <CopyButton
          value={code}
          successMessage="Command copied"
          label={`Copy the command: ${code.split("\n")[0] ?? code}`}
          iconOnly
          narrow={narrow}
          onCopy={onCopy}
        />
      </div>
    </div>
  );
}

export function CopyButton({
  value,
  successMessage,
  label,
  iconOnly = false,
  narrow = false,
  onCopy,
}: {
  value: string;
  successMessage: string;
  /** Names what is copied. Required for the icon-only form. */
  label: string;
  iconOnly?: boolean;
  narrow?: boolean;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { focusRing, focusProps } = useFocusRing();

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("Your browser blocked the clipboard.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch {
      toast.error("Your browser blocked the clipboard.");
    }
  };

  const size = narrow ? 44 : 26;

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...focusProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        minHeight: size,
        ...(iconOnly ? { minWidth: size } : { padding: "3px 9px" }),
        borderRadius: 6,
        border: iconOnly ? "none" : "1px solid var(--line)",
        background: iconOnly
          ? hovered
            ? "var(--inset)"
            : "none"
          : hovered
            ? "var(--subtle)"
            : "var(--surface)",
        color: copied ? "var(--success)" : "var(--text-2)",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        outline: "none",
        boxShadow: focusRing,
      }}
    >
      <Icon name={copied ? "i-check" : "i-clipboard"} size={13} />
      {iconOnly ? null : copied ? "Copied" : "Copy"}
    </button>
  );
}
