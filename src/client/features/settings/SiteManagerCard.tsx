import { useState } from "react";

import { Icon } from "@/client/components/icons/IconSprite";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import type { ProjectSummary } from "@/client/features/projects/types";
import { SiteConnectionsTab } from "@/client/features/settings/SiteConnectionsTab";
import { DetailsTab } from "@/client/features/settings/SiteDetailsTab";
import { RemoveTab } from "@/client/features/settings/SiteRemoveTab";
import { formatDay } from "@/client/features/settings/settingsParts";

type SiteTab = "details" | "connections" | "danger";

/**
 * Inline manager for one site: its details, its Google connections, and
 * removal. Everything here writes through the same project endpoints the
 * per-project settings page uses, so the two surfaces cannot drift.
 */
export function SiteManagerCard({
  id,
  site,
  canRemove,
  onClose,
  onOpenProviderKey,
}: {
  id: string;
  site: ProjectSummary;
  /** The app keeps at least one site, so the last one cannot be removed. */
  canRemove: boolean;
  onClose: () => void;
  onOpenProviderKey: (provider: string) => void;
}) {
  const [tab, setTab] = useState<SiteTab>("details");
  const added = formatDay(site.createdAt);

  return (
    <div
      id={id}
      style={{
        marginTop: 12,
        border: "1px solid var(--line)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "11px 13px",
          background: "var(--subtle)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{site.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
            {site.domain ?? "No domain set"}
            {added ? ` · added ${added}` : ""}
          </div>
        </div>
        <SecondaryButton
          onClick={onClose}
          aria-label="Close site settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            minHeight: 24,
            padding: 0,
            color: "var(--text-2)",
          }}
        >
          <Icon name="i-x" size={13} />
        </SecondaryButton>
      </div>

      <div
        role="tablist"
        aria-label="Site settings"
        style={{
          display: "flex",
          gap: 2,
          padding: "0 13px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <SiteTabButton
          active={tab === "details"}
          panelId={`${id}-details`}
          onSelect={() => setTab("details")}
        >
          Details
        </SiteTabButton>
        <SiteTabButton
          active={tab === "connections"}
          panelId={`${id}-connections`}
          onSelect={() => setTab("connections")}
        >
          Connections
        </SiteTabButton>
        <SiteTabButton
          active={tab === "danger"}
          panelId={`${id}-danger`}
          danger
          onSelect={() => setTab("danger")}
        >
          Remove
        </SiteTabButton>
      </div>

      {tab === "details" ? (
        <div id={`${id}-details`} role="tabpanel" style={{ padding: 13 }}>
          <DetailsTab site={site} onClose={onClose} />
        </div>
      ) : null}
      {tab === "connections" ? (
        <div id={`${id}-connections`} role="tabpanel">
          <SiteConnectionsTab
            projectId={site.id}
            onOpenProviderKey={onOpenProviderKey}
          />
        </div>
      ) : null}
      {tab === "danger" ? (
        <div id={`${id}-danger`} role="tabpanel" style={{ padding: 13 }}>
          <RemoveTab site={site} canRemove={canRemove} onRemoved={onClose} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The design's underline tab, with a danger-toned active state for Remove.
 * It reuses the shared `.prominence-tab` rules rather than the Tab primitive,
 * which has no danger tone.
 */
function SiteTabButton({
  active,
  danger,
  panelId,
  onSelect,
  children,
}: {
  active: boolean;
  danger?: boolean;
  panelId: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const accent = danger ? "var(--danger)" : "var(--accent)";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      onClick={onSelect}
      className="prominence-tab"
      style={{
        color: active
          ? danger
            ? "var(--danger)"
            : "var(--text)"
          : "var(--text-2)",
        fontWeight: active ? 600 : 400,
        boxShadow: active ? `inset 0 -2px 0 ${accent}` : undefined,
      }}
    >
      {children}
    </button>
  );
}
