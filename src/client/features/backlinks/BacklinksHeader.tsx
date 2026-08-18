import { useEffect, useId, useRef, useState } from "react";
import {
  PageHeaderBand,
  SecondaryButton,
  StatusPill,
  Tab,
  TabStrip,
} from "@/client/components/prominence/Primitives";
import { ButtonSpinner } from "./BacklinksControls";
import type { BacklinksUiTab } from "./backlinksPageTypes";

/** What PrimaryButton wraps its children in, for the two buttons below that
 * need a ref and so cannot use it. */
const BUTTON_INNER: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

/** One panel holds whichever tab is on screen; the tabs all point at it. */
export const BACKLINKS_PANEL_ID = "backlinks-tab-panel";

const TABS: { key: BacklinksUiTab; label: string }[] = [
  { key: "domains", label: "Referring domains" },
  { key: "backlinks", label: "Backlinks" },
  { key: "pages", label: "Top pages" },
  { key: "anchors", label: "Anchors" },
];

/**
 * Scope confirmation for the snapshot refresh.
 *
 * The design has no dialog anywhere — no `role="dialog"`, no scrim, no modal —
 * so a job that must state its scope first states it in place: the panel opens
 * directly beneath the header band, the page stays reachable behind it, and
 * Escape or Cancel closes it and returns focus to the button that opened it.
 */
function RefreshScopeConfirm({
  target,
  scopeLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  target: string;
  scopeLabel: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <section
      aria-labelledby={titleId}
      style={{
        margin: "12px var(--pad, 24px)",
        maxWidth: 560,
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "11px 13px" }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
          Refresh the snapshot for {target}?
        </h2>
        {/* The six-hour hold is the real constraint on this job, so it is what
            the confirm spends its sentence on. There is no duration claim,
            because nothing here measures one. */}
        <p
          style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--text-2)" }}
        >
          This re-reads every source for{" "}
          {scopeLabel ? scopeLabel.toLowerCase() : "this target"} coverage and
          redraws the tables. Sources are cached for six hours, so a refresh
          inside that window returns the snapshot you already have.
        </p>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          padding: "10px 13px",
          background: "var(--subtle)",
          borderTop: "1px solid var(--border-muted)",
        }}
      >
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        {/* Written out rather than taken from the primitive: focus has to move
            here when the panel opens, and PrimaryButton accepts no ref. The
            class carries the design's primary treatment either way. */}
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="prominence-button-primary"
        >
          <span style={BUTTON_INNER}>
            {busy ? <ButtonSpinner /> : null}
            {busy ? "Refreshing…" : "Refresh now"}
          </span>
        </button>
      </div>
    </section>
  );
}

/**
 * Title band and tab strip. The refresh button owns its running state here so
 * the page keeps the data wiring and this keeps the chrome.
 */
export function BacklinksHeader({
  title,
  target,
  scopeLabel,
  subtitle,
  search,
  hasTarget,
  activeTab,
  onTabChange,
  canExport,
  onExportCsv,
  onRefresh,
}: {
  title: string;
  /** The site or page the snapshot is for, named in the scope confirm. */
  target: string;
  scopeLabel: string | null;
  subtitle: string;
  /** The lookup row, which sits between the title and the tabs. */
  search: React.ReactNode;
  hasTarget: boolean;
  activeTab: BacklinksUiTab;
  onTabChange: (tab: BacklinksUiTab) => void;
  canExport: boolean;
  onExportCsv: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmingRefresh, setConfirmingRefresh] = useState(false);
  const refreshRef = useRef<HTMLButtonElement | null>(null);

  const closeConfirm = () => {
    setConfirmingRefresh(false);
    refreshRef.current?.focus();
  };

  const refresh = async () => {
    setConfirmingRefresh(false);
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      refreshRef.current?.focus();
    }
  };

  return (
    <>
      <PageHeaderBand
        title={title}
        badge={
          scopeLabel ? (
            <StatusPill tone="neutral">{scopeLabel}</StatusPill>
          ) : null
        }
        subtitle={subtitle}
        actions={
          hasTarget ? (
            <>
              <SecondaryButton
                icon="i-download"
                onClick={onExportCsv}
                disabled={!canExport}
                title={
                  canExport ? undefined : "Nothing to export in this tab yet"
                }
              >
                Export CSV
              </SecondaryButton>
              <button
                ref={refreshRef}
                type="button"
                onClick={() =>
                  confirmingRefresh
                    ? closeConfirm()
                    : setConfirmingRefresh(true)
                }
                disabled={isRefreshing}
                aria-expanded={confirmingRefresh}
                className="prominence-button-primary"
                style={isRefreshing ? { cursor: "progress" } : undefined}
              >
                <span style={BUTTON_INNER}>
                  {isRefreshing ? <ButtonSpinner /> : null}
                  {isRefreshing ? "Refreshing…" : "Refresh snapshot"}
                </span>
              </button>
            </>
          ) : null
        }
        tabs={
          <>
            <div style={{ marginTop: 12, marginBottom: hasTarget ? 0 : 14 }}>
              {search}
            </div>
            {hasTarget ? (
              <TabStrip>
                {TABS.map(({ key, label }) => (
                  <Tab
                    key={key}
                    active={activeTab === key}
                    controls={BACKLINKS_PANEL_ID}
                    onClick={() => onTabChange(key)}
                  >
                    {label}
                  </Tab>
                ))}
              </TabStrip>
            ) : null}
          </>
        }
      />
      {confirmingRefresh ? (
        <RefreshScopeConfirm
          target={target}
          scopeLabel={scopeLabel}
          busy={isRefreshing}
          onConfirm={() => void refresh()}
          onCancel={closeConfirm}
        />
      ) : null}
    </>
  );
}
