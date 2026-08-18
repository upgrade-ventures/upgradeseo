import { useState } from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import type { CsvValue } from "@/client/lib/csv";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import type { BacklinksUiTab } from "./backlinksPageTypes";
import type { BacklinksFiltersState } from "./useBacklinksFilters";

/** The design's button spinner: a ring with one quarter cut out. */
export function ButtonSpinner({ color = "currentColor" }: { color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 11,
        height: 11,
        borderRadius: 999,
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        animation: "spin 1s linear infinite",
      }}
    />
  );
}

/** Toggle buttons carry the design's selected treatment rather than a border. */
const SELECTED_TOGGLE: React.CSSProperties = {
  background: "var(--accent-soft)",
  borderColor: "var(--accent-border)",
  color: "var(--accent)",
  fontWeight: 600,
};

function ToggleButton({
  selected,
  onClick,
  title,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <SecondaryButton
      aria-pressed={selected}
      onClick={onClick}
      title={title}
      style={selected ? SELECTED_TOGGLE : undefined}
    >
      {children}
    </SecondaryButton>
  );
}

/**
 * The controls the design has no place for: table filters, the backlinks
 * grouping toggle, the opt-in Ahrefs DR lookup and the Sheets export. They sit
 * in their own band between the counters and the table so the header keeps the
 * two actions the design gives it.
 */
export function BacklinksToolbar({
  activeTab,
  filters,
  view,
  onViewChange,
  domainRatingsLoaded,
  isLoadingRatings,
  onLoadRatings,
  sheetsExport,
}: {
  activeTab: BacklinksUiTab;
  filters: BacklinksFiltersState;
  view: "all" | undefined;
  onViewChange: (view: "all" | undefined) => void;
  domainRatingsLoaded: boolean;
  isLoadingRatings: boolean;
  onLoadRatings: () => void;
  sheetsExport: { headers: string[]; rows: CsvValue[][]; feature: string };
}) {
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const filterState = activeTab === "anchors" ? null : filters[activeTab];
  const canExport = sheetsExport.rows.length > 0 && !isExportingSheets;
  const canRateDomains = activeTab === "backlinks" || activeTab === "domains";

  const handleExportToSheets = async () => {
    if (!canExport) return;
    setIsExportingSheets(true);
    try {
      await exportTableToSheets(sheetsExport);
    } finally {
      setIsExportingSheets(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "8px var(--pad, 24px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {filterState ? (
        <ToggleButton
          selected={filters.showFilters}
          onClick={() => filters.setShowFilters((current) => !current)}
          title="Toggle table filters"
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Filters
            {filterState.activeFilterCount > 0 ? (
              <span
                style={{
                  minWidth: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "var(--accent)",
                  color: "var(--text-inv)",
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: "16px",
                  textAlign: "center",
                }}
              >
                {filterState.activeFilterCount}
              </span>
            ) : null}
          </span>
        </ToggleButton>
      ) : null}

      {activeTab === "backlinks" ? (
        <div
          role="group"
          aria-label="Backlinks grouping"
          style={{ display: "flex", gap: 4 }}
        >
          <ToggleButton
            selected={view !== "all"}
            onClick={() => onViewChange(undefined)}
            title="Show each referring domain's strongest link; expand a row for the rest"
          >
            One per domain
          </ToggleButton>
          <ToggleButton
            selected={view === "all"}
            onClick={() => onViewChange("all")}
            title="List every individual backlink"
          >
            All links
          </ToggleButton>
        </div>
      ) : null}

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        {canRateDomains ? (
          <SecondaryButton
            onClick={onLoadRatings}
            disabled={isLoadingRatings}
            title="Look up the Ahrefs Domain Rating for each domain in the table"
          >
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {isLoadingRatings ? <ButtonSpinner /> : null}
              {domainRatingsLoaded ? "Refresh Ahrefs DR" : "Ahrefs DR"}
            </span>
          </SecondaryButton>
        ) : null}
        <SecondaryButton
          onClick={() => void handleExportToSheets()}
          disabled={!canExport}
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {isExportingSheets ? <ButtonSpinner /> : null}
            Export to Sheets
          </span>
        </SecondaryButton>
      </div>
    </div>
  );
}
