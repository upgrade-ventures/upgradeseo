import * as React from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { SmallButton } from "./RankScreenParts";

/**
 * The pieces that stand in for a dialog.
 *
 * The design contains no modal anywhere: a form, a detail view or a
 * confirmation opens as a band in the page flow, so the table it is about never
 * leaves the screen and there is no scrim, focus trap or escape hatch to get
 * wrong.
 */

/**
 * A full-bleed band that holds an inline panel.
 *
 * The design has no modals, so anything that would have been one — the add or
 * edit form, a keyword's position history, a scope confirm — opens as a band in
 * the page flow with the screen's own gutter and hairline.
 */
export function PanelBand({
  tone = "surface",
  children,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "surface" | "subtle" | "accent" | "danger";
}) {
  const tones = {
    surface: { background: "var(--surface)", borderColor: "var(--line)" },
    subtle: { background: "var(--subtle)", borderColor: "var(--line)" },
    accent: {
      background: "var(--accent-soft)",
      borderColor: "var(--accent-border)",
    },
    danger: {
      background: "var(--danger-soft)",
      borderColor: "var(--danger-border)",
    },
  }[tone];
  return (
    <div
      {...rest}
      style={{
        padding: "12px var(--pad,24px)",
        background: tones.background,
        borderBottom: `1px solid ${tones.borderColor}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The two-step confirm the design uses in place of a dialog: the question and
 * its consequence stated in place, then the real action beside a Cancel.
 *
 * `busy` keeps the confirm genuinely `disabled` while the request is in flight,
 * so a second click cannot fire the same destructive call twice.
 */
export function InlineConfirm({
  question,
  detail,
  confirmLabel,
  busyLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  question: string;
  detail?: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={question}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        fontSize: 12.5,
      }}
    >
      <span>
        <span style={{ fontWeight: 600 }}>{question}</span>
        {detail ? (
          <span style={{ color: "var(--text-2)" }}> {detail}</span>
        ) : null}
      </span>
      <span style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        <SmallButton onClick={onCancel} disabled={busy}>
          Cancel
        </SmallButton>
        <SmallButton tone="danger" onClick={onConfirm} disabled={busy}>
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </SmallButton>
      </span>
    </div>
  );
}

/**
 * Title row for a panel band: what it is, which step of a flow it is, and the
 * labelled control that dismisses it. The close button is icon-only, so its
 * aria-label names the panel rather than reading as a bare "close".
 */
export function PanelHeader({
  title,
  step,
  onClose,
}: {
  title: string;
  /** e.g. "Step 2 of 2 · Keywords", from the design's wizard header. */
  step?: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{title}</h2>
        {step ? (
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{step}</span>
        ) : null}
      </div>
      <SmallButton
        tone="ghost"
        onClick={onClose}
        title="Close"
        aria-label={`Close ${title.toLowerCase()}`}
        style={{ padding: "2px 6px" }}
      >
        <Icon name="i-x" size={14} />
      </SmallButton>
    </div>
  );
}
