import { useEffect, useRef, type ReactNode } from "react";

/**
 * The design's "Confirm before spending" card, rendered in place.
 *
 * The reference carries this pattern as a specimen with a border, a shadow and
 * an `--overlay` fill, but it is not a modal: there is no `role="dialog"` and
 * no `aria-modal` anywhere in the design, and the product has no modal surface
 * at all. So the card is drawn in flow, directly under the control that raised
 * it, and focus moves onto the confirm button so a keyboard user lands on the
 * decision rather than having to hunt for it.
 *
 * `body` states scope as work and time, never as a price.
 */
export function InlineConfirm({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  busyLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      // Announced when it appears, because it interrupts the action the user
      // just asked for and is waiting on an answer.
      role="group"
      aria-live="polite"
      onKeyDown={(event) => {
        // Escape backs out, the same as Cancel. The design states that contract
        // in words under its own confirm card.
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCancel();
      }}
      style={{
        maxWidth: 460,
        marginTop: 10,
        border: "1px solid var(--line)",
        borderRadius: 8,
        boxShadow: "var(--shadow)",
        background: "var(--overlay)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "11px 13px",
          borderBottom: "1px solid var(--border-muted)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <p
          style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--text-2)" }}
        >
          {body}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          padding: "10px 13px",
          background: "var(--subtle)",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="prominence-button-secondary max-sm:min-h-11"
        >
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="prominence-button-primary max-sm:min-h-11"
        >
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </div>
  );
}
