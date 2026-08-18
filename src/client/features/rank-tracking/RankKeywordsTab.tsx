import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type {
  ComparePeriod,
  RankTrackingConfig,
  RankTrackingRow,
} from "@/types/schemas/rank-tracking";
import {
  applyFilters,
  countActiveFilters,
  EMPTY_FILTERS,
  FilterPanel,
  type Filters,
} from "./RankTrackingFilters";
import { RankTrackingTable } from "./RankTrackingTable";
import {
  exportRankTrackingCsv,
  exportRankTrackingToSheets,
} from "./RankTrackingTableParts";
import { ExportMenu } from "./ToolbarMenus";
import { Chip, InfoDotNote, SmallButton } from "./RankScreenParts";
import { KpiStrip } from "./RankKpiStrip";
import { computeScorecards } from "./rankTrackingScorecards";
import {
  applyRankView,
  RANK_VIEWS,
  type RankView,
  type TrackedDevice,
} from "./rankViews";
import { formatCount } from "./rankFormat";

const COMPARE_OPTIONS: { value: ComparePeriod; label: string }[] = [
  { value: "1d", label: "yesterday" },
  { value: "7d", label: "7 days ago" },
  { value: "30d", label: "30 days ago" },
  { value: "90d", label: "90 days ago" },
];

/**
 * The Keywords tab: the set's five headline numbers, the saved views, and the
 * keyword table.
 *
 * The design's view chips only raise a toast. Here they are real filters over
 * the rows already loaded, and "All keywords" is the default so the screen
 * still opens on the whole set.
 */
export function RankKeywordsTab({
  config,
  projectId,
  rows,
  isLoading,
  isError,
  onRetry,
  device,
  onDeviceChange,
  comparePeriod,
  onComparePeriodChange,
  runNotice,
  hasMeasuredPositions,
  addKeywordsPanel,
  onAddKeywords,
}: {
  config: RankTrackingConfig;
  projectId: string;
  rows: RankTrackingRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  device: "desktop" | "mobile";
  onDeviceChange: (device: "desktop" | "mobile") => void;
  comparePeriod: ComparePeriod;
  onComparePeriodChange: (period: ComparePeriod) => void;
  /** The run's own note about where its positions came from. */
  runNotice: string | null;
  hasMeasuredPositions: boolean;
  addKeywordsPanel: ReactNode;
  onAddKeywords: () => void;
}) {
  const [view, setView] = useState<RankView>("all");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const showDesktop = config.devices !== "mobile";
  const showMobile = config.devices !== "desktop";
  const trackedDevices = useMemo<TrackedDevice[]>(() => {
    const devices: TrackedDevice[] = [];
    if (showDesktop) devices.push("desktop");
    if (showMobile) devices.push("mobile");
    return devices;
  }, [showDesktop, showMobile]);

  const activeFilterCount = countActiveFilters(filters);
  const visible = useMemo(
    () => applyRankView(applyFilters(rows, filters), view, trackedDevices),
    [rows, filters, view, trackedDevices],
  );
  // The strip describes the whole set, not the current view: a KPI that moved
  // because the user clicked a chip is not a KPI.
  const scorecards = useMemo(
    () => computeScorecards(rows, device),
    [rows, device],
  );

  const narrowed = view !== "all" || activeFilterCount > 0;
  const resetView = () => {
    setView("all");
    setFilters(EMPTY_FILTERS);
  };

  return (
    <>
      <KpiStrip
        isLoading={isLoading}
        scorecards={scorecards}
        total={rows.length}
        serpDepth={config.serpDepth}
        deviceSuffix={
          config.devices === "both"
            ? device === "desktop"
              ? " · desktop"
              : " · mobile"
            : ""
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px var(--pad,24px)",
          borderBottom: "1px solid var(--line)",
          background: "var(--subtle)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Views</span>
        {RANK_VIEWS.map((option) => (
          <Chip
            key={option.id}
            active={view === option.id}
            title={option.help}
            onClick={() => setView(option.id)}
          >
            {option.label}
          </Chip>
        ))}

        <Divider />

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-2)",
          }}
        >
          Compare to
          <select
            value={comparePeriod}
            onChange={(event) =>
              onComparePeriodChange(toComparePeriod(event.target.value))
            }
            style={{
              minHeight: 24,
              padding: "2px 6px",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--text)",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {COMPARE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {config.devices === "both" ? (
          <>
            <Divider />
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              Summarise
            </span>
            <Chip
              active={device === "desktop"}
              onClick={() => onDeviceChange("desktop")}
            >
              Desktop
            </Chip>
            <Chip
              active={device === "mobile"}
              onClick={() => onDeviceChange("mobile")}
            >
              Mobile
            </Chip>
          </>
        ) : null}

        <Divider />

        <SmallButton
          onClick={() => setShowFilters((current) => !current)}
          title="Filter by position, volume, difficulty or CPC"
          aria-expanded={showFilters}
        >
          Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
        </SmallButton>
        <ExportMenu
          hasData={visible.length > 0}
          onExport={() =>
            exportRankTrackingCsv(
              visible,
              showDesktop,
              showMobile,
              config.domain,
              config.locationName,
            )
          }
          onExportToSheets={() =>
            exportRankTrackingToSheets(
              visible,
              showDesktop,
              showMobile,
              config.locationName,
            )
          }
          onCopyKeywords={() => {
            void navigator.clipboard.writeText(
              visible.map((row) => row.keyword).join("\n"),
            );
            toast.success("Keywords copied to clipboard");
          }}
        />

        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: "var(--text-3)",
          }}
        >
          {isLoading ? null : (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCount(visible.length)} of {formatCount(rows.length)}
            </span>
          )}
          <Keycap>J</Keycap>
          <Keycap>K</Keycap>
          move between keywords
          <Keycap>↵</Keycap>
          position history
        </span>
      </div>

      {showFilters ? (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          activeFilterCount={activeFilterCount}
          onReset={() => setFilters(EMPTY_FILTERS)}
        />
      ) : null}

      {addKeywordsPanel}

      <RankTrackingTable
        rows={visible}
        totalCount={rows.length}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        narrowed={narrowed}
        onResetView={resetView}
        onAddKeywords={onAddKeywords}
        showDesktop={showDesktop}
        showMobile={showMobile}
        serpDepth={config.serpDepth}
        domain={config.domain}
        configId={config.id}
        projectId={projectId}
        locationCode={config.locationCode}
        locationName={config.locationName}
      />

      <InfoDotNote style={{ margin: "16px var(--pad,24px) 40px" }}>
        {runNotice ? (
          <>
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>
              How these positions were measured.
            </strong>{" "}
            {runNotice}
          </>
        ) : hasMeasuredPositions ? (
          <>
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>
              Every position here was measured, never estimated.
            </strong>{" "}
            A keyword no check has reported on reads &quot;not measured&quot;
            rather than showing a position we do not have.
          </>
        ) : (
          <>
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>
              No check has completed yet.
            </strong>{" "}
            Run one to measure positions. Until then this table has nothing to
            report, and it will not guess.
          </>
        )}
      </InfoDotNote>
    </>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 16,
        background: "var(--line)",
        margin: "0 4px",
      }}
    />
  );
}

function Keycap({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        letterSpacing: ".01em",
        border: "1px solid var(--line)",
        borderRadius: 4,
        padding: "0 4px",
        background: "var(--surface)",
      }}
    >
      {children}
    </span>
  );
}

/** The select only ever holds these four, but the DOM types it as string. */
function toComparePeriod(value: string): ComparePeriod {
  return value === "1d" || value === "7d" || value === "30d" || value === "90d"
    ? value
    : "7d";
}
