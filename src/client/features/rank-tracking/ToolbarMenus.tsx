import { useEffect, useState, type ReactNode } from "react";
import type { IconName } from "@/client/components/icons/IconSprite";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { Spinner, useInteractive } from "./RankScreenParts";

/**
 * The two overflow menus the rank screen keeps.
 *
 * The design draws no menus on this screen, so these are built from the same
 * tokens as the command palette it does draw: surface, hairline, 8px radius,
 * one elevation. Hover lives in component state because this screen cannot add
 * CSS rules.
 */
function ToolbarMenu({
  label,
  icon,
  title,
  children,
}: {
  label?: string;
  icon?: IconName;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <SecondaryButton
        icon={icon}
        onClick={() => setOpen((current) => !current)}
        title={title}
        aria-label={label ? undefined : title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </SecondaryButton>
      {open ? (
        <>
          {/* Click-away catcher: a menu that only closes on re-click strands
              the next click somewhere the user did not mean it. */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              marginTop: 4,
              zIndex: 50,
              minWidth: 232,
              padding: "4px 0",
              background: "var(--overlay)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              boxShadow: "var(--shadow)",
            }}
          >
            {children}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({
  label,
  description,
  onClick,
  disabled,
  busy,
}: {
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { hovered, focused, interactiveProps } = useInteractive();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      {...interactiveProps}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 13px",
        border: "none",
        background: hovered && !disabled ? "var(--subtle)" : "transparent",
        color: "var(--text)",
        fontFamily: "inherit",
        fontSize: 12.5,
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        outline: "none",
        boxShadow: focused ? "var(--focus)" : undefined,
      }}
    >
      {busy ? <Spinner size={11} color="var(--text-3)" /> : null}
      <span>
        <span style={{ display: "block" }}>{label}</span>
        {description ? (
          <span
            style={{ display: "block", fontSize: 11, color: "var(--text-3)" }}
          >
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function MoreMenu({
  onConfigure,
  onRefreshMetrics,
  metricsRefreshing,
  hasData,
}: {
  onConfigure: () => void;
  onRefreshMetrics: () => void;
  metricsRefreshing: boolean;
  hasData: boolean;
}) {
  return (
    <ToolbarMenu label="More" icon="i-chev-down" title="More actions">
      <MenuItem
        label="Configure tracking"
        description="Location, devices, depth and schedule"
        onClick={onConfigure}
      />
      <MenuItem
        label={metricsRefreshing ? "Updating…" : "Update keyword stats"}
        description="Volume, difficulty and CPC — not positions"
        onClick={onRefreshMetrics}
        disabled={metricsRefreshing || !hasData}
        busy={metricsRefreshing}
      />
    </ToolbarMenu>
  );
}

export function ExportMenu({
  onExport,
  onExportToSheets,
  onCopyKeywords,
  hasData,
}: {
  onExport: () => void;
  onExportToSheets: () => void;
  onCopyKeywords: () => void;
  hasData: boolean;
}) {
  return (
    <ToolbarMenu
      label="Export"
      icon="i-download"
      title="Export the keywords shown"
    >
      <MenuItem label="Export CSV" onClick={onExport} disabled={!hasData} />
      <MenuItem
        label="Export to Sheets"
        onClick={onExportToSheets}
        disabled={!hasData}
      />
      <MenuItem
        label="Copy keywords"
        onClick={onCopyKeywords}
        disabled={!hasData}
      />
    </ToolbarMenu>
  );
}
