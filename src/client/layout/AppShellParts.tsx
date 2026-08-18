import * as React from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Icon } from "@/client/components/icons/IconSprite";
import { Sidebar } from "@/client/components/Sidebar";
import { freeSetupHelpLinkOptions } from "@/client/navigation/items";

/**
 * The setup notice.
 *
 * A full-bleed bar flush under the app header: no radius, no shadow, no outer
 * margin, and the same horizontal gutter as the page body. The previous
 * floating filled box read as an error and dominated the page it was meant to
 * annotate.
 *
 * `role="status"` rather than `alert` — the app still works, this is
 * information about what is not connected yet.
 */
function SeoApiStatusBanners({
  shouldShowSeoApiWarning,
  seoApiKeyStatusError,
}: {
  shouldShowSeoApiWarning: boolean;
  seoApiKeyStatusError: boolean;
}) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  if (shouldShowSeoApiWarning) {
    return (
      <StatusBar
        tone="warning"
        // Consequence first, then the reassurance.
        primary="Keyword research needs a data source."
        secondary="Site Audit and Competitors already work without one, and connecting is free."
        actionLabel="Connect a source"
        onDismiss={() => {
          setDismissed(true);
          toast.success("Notice hidden. Reopen it from Settings.");
        }}
      />
    );
  }

  if (seoApiKeyStatusError) {
    return (
      <StatusBar
        tone="info"
        primary="We could not check which data sources are connected."
        secondary="If a feature is not working, review the setup guide."
        actionLabel="Open setup guide"
        onDismiss={() => {
          setDismissed(true);
          toast.success("Notice hidden. Reopen it from Settings.");
        }}
      />
    );
  }

  return null;
}

function StatusBar({
  tone,
  primary,
  secondary,
  actionLabel,
  onDismiss,
}: {
  tone: "warning" | "info";
  primary: string;
  secondary: string;
  actionLabel: string;
  onDismiss: () => void;
}) {
  const soft = tone === "warning" ? "var(--warning-soft)" : "var(--info-soft)";
  const border =
    tone === "warning" ? "var(--warning-border)" : "var(--info-border)";
  const icon = tone === "warning" ? "var(--warning)" : "var(--info)";

  return (
    <div
      role="status"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "9px var(--pad, 24px)",
        background: soft,
        borderBottom: `1px solid ${border}`,
      }}
    >
      <Icon name="i-alert" size={15} style={{ color: icon, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
        <span style={{ color: "var(--text)" }}>{primary}</span>{" "}
        <span style={{ color: "var(--text-2)" }}>{secondary}</span>
      </div>
      <Link
        {...freeSetupHelpLinkOptions}
        style={{ fontSize: 12.5, whiteSpace: "nowrap" }}
      >
        {actionLabel}
      </Link>
      <button
        type="button"
        aria-label="Hide this notice"
        onClick={onDismiss}
        className="prominence-bar-dismiss"
      >
        <Icon name="i-x" size={13} />
      </button>
    </div>
  );
}

function MobileSidebarDrawer({
  open,
  projectId,
  onClose,
}: {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
}) {
  // Escape closes the drawer, matching every other dismissible surface in the
  // shell. Bound while open only, so it never competes with the palette's.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Scrim sits at 55, below the drawer's 60 and above the palette's 50 —
          the design's z-index ladder, followed exactly. */}
      <button
        type="button"
        aria-label="Close navigation"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 12, 14, 0.45)",
          zIndex: 55,
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 60,
          boxShadow: "var(--shadow)",
        }}
      >
        <Sidebar projectId={projectId} onNavigate={onClose} onClose={onClose} />
      </div>
    </>
  );
}

export { MobileSidebarDrawer, SeoApiStatusBanners };
