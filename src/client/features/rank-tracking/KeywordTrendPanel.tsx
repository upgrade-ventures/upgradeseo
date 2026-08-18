import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import { captureClientEvent } from "@/client/lib/posthog";
import { getRankKeywordHistory } from "@/serverFunctions/rank-tracking";
import { LOCATIONS } from "@/client/features/keywords/locations";
import { formatLocationLabel } from "@/shared/keyword-locations";
import { Icon } from "@/client/components/icons/IconSprite";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { csvChange, DeviceRankCell } from "./RankTrackingTableParts";
import {
  RankTrendChart,
  TrendRangeToggle,
  type TrendSeries,
} from "./RankTrackingTrendChart";
import {
  HEAD_ROW,
  HoverRow,
  Skeleton,
  SmallButton,
  TABLE,
  TD,
  TD_NUM,
  TH,
  TH_RIGHT,
} from "./RankScreenParts";
import { ChartTooltipBox } from "./RankChartParts";
import { PanelBand } from "./RankPanelParts";
import {
  buildChartData,
  buildHistoryRows,
  deriveDevices,
  slugify,
} from "./keywordTrend";

// Two lines in one plot need two distinguishable strokes, and only --accent and
// --purple are token hues that read as "a series" rather than as a status.
const DEVICE_STYLE: Record<
  "desktop" | "mobile",
  { label: string; color: string }
> = {
  desktop: { label: "Desktop", color: "var(--accent)" },
  mobile: { label: "Mobile", color: "var(--purple)" },
};

export interface KeywordTrendTarget {
  trackingKeywordId: string;
  keyword: string;
}

/**
 * One keyword's position over time.
 *
 * The design has no dialogs, so this opens as a band directly above the table
 * that raised it: the row stays in view, and closing it is a labelled button
 * rather than a scrim.
 */
export function KeywordTrendPanel({
  target,
  projectId,
  configId,
  domain,
  locationCode,
  locationName,
  serpDepth,
  onClose,
}: {
  target: KeywordTrendTarget;
  projectId: string;
  configId: string;
  domain: string;
  locationCode: number;
  locationName?: string;
  serpDepth: number;
  onClose: () => void;
}) {
  const [sinceDays, setSinceDays] = useState(730);

  const {
    data: history,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "rankKeywordHistory",
      projectId,
      configId,
      target.trackingKeywordId,
      sinceDays,
    ],
    queryFn: () =>
      getRankKeywordHistory({
        data: {
          projectId,
          configId,
          trackingKeywordId: target.trackingKeywordId,
          sinceDays,
        },
      }),
  });

  const points = useMemo(() => history ?? [], [history]);
  const devices = useMemo(() => deriveDevices(points), [points]);

  // A single run yields one point per device, so for a both-devices config
  // `points.length` is 2 after one check. The trend only fills in once any one
  // device has 2+ checks, so gate the empty state on the per-device count.
  const maxPerDevice = useMemo(
    () =>
      devices.length === 0
        ? 0
        : Math.max(
            ...devices.map((d) => points.filter((p) => p.device === d).length),
          ),
    [points, devices],
  );

  const series: TrendSeries[] = devices.map((device) => ({
    dataKey: device,
    name: DEVICE_STYLE[device].label,
    color: DEVICE_STYLE[device].color,
    strokeDasharray: "4 3",
  }));

  const chartData = useMemo(
    () => buildChartData(points, serpDepth),
    [points, serpDepth],
  );

  // Keys ("<ts>:<device>") whose plotted point sits in the bottom band because
  // the real position was null — so the tooltip can say "Not in top N"
  // unambiguously even when a genuine position equals serpDepth.
  const bottomBandKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of points) {
      if (p.position === null) {
        keys.add(`${new Date(p.checkedAt).getTime()}:${p.device}`);
      }
    }
    return keys;
  }, [points]);

  const historyRows = useMemo(() => buildHistoryRows(points), [points]);

  const exportRows = () =>
    historyRows.map((r) => [
      new Date(r.checkedAt).toISOString(),
      DEVICE_STYLE[r.device].label,
      r.position ?? "",
      csvChange(r.position, r.previousPosition),
    ]);

  const CSV_HEADERS = ["Date", "Device", "Position", "Change vs previous"];

  const handleCopy = () => {
    void navigator.clipboard.writeText(buildCsv(CSV_HEADERS, exportRows()));
    toast.success("Position history copied to clipboard");
    captureClientEvent("rank_tracking:keyword_trend_copy");
  };

  const handleExport = () => {
    downloadCsv(
      `rank-history-${slugify(target.keyword)}.csv`,
      buildCsv(CSV_HEADERS, exportRows()),
    );
    captureClientEvent("rank_tracking:keyword_trend_export");
  };

  return (
    <PanelBand tone="subtle">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            {target.keyword}
          </h3>
          <p
            style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-2)" }}
          >
            {domain} ·{" "}
            {locationName
              ? formatLocationLabel(locationName, 2)
              : (LOCATIONS[locationCode] ?? String(locationCode))}{" "}
            · position over time
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <TrendRangeToggle value={sinceDays} onChange={setSinceDays} />
          <SmallButton
            tone="ghost"
            onClick={onClose}
            title="Close"
            aria-label={`Close the position history for ${target.keyword}`}
            style={{ padding: "2px 6px" }}
          >
            <Icon name="i-x" size={14} />
          </SmallButton>
        </div>
      </div>

      {isLoading ? (
        <div
          aria-busy
          aria-label={`Loading the position history for ${target.keyword}`}
        >
          <Skeleton width="100%" height={224} />
        </div>
      ) : isError ? (
        <TrendMessage
          action={
            <SecondaryButton onClick={() => void refetch()}>
              Try again
            </SecondaryButton>
          }
        >
          Could not load the position history for this keyword.
        </TrendMessage>
      ) : maxPerDevice <= 1 ? (
        <TrendMessage>
          {maxPerDevice === 0
            ? "No check has recorded a position for this keyword yet. Run one to start the history."
            : "One check so far. The trend line starts after the next one."}
        </TrendMessage>
      ) : (
        <>
          <RankTrendChart
            data={chartData}
            series={series}
            serpDepth={serpDepth}
            showBottomBand
            renderTooltip={(label, entries) => (
              <TrendTooltip
                label={label}
                entries={entries}
                serpDepth={serpDepth}
                bottomBandKeys={bottomBandKeys}
              />
            )}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              margin: "8px 0",
            }}
          >
            <SmallButton onClick={handleCopy}>Copy</SmallButton>
            <SmallButton onClick={handleExport}>Export CSV</SmallButton>
          </div>

          <div
            style={{
              maxHeight: 260,
              overflow: "auto",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "var(--surface)",
            }}
          >
            <table style={{ ...TABLE, minWidth: 380 }}>
              <thead>
                <tr style={HEAD_ROW}>
                  <th style={TH}>Date</th>
                  {devices.length > 1 ? <th style={TH}>Device</th> : null}
                  <th style={TH_RIGHT}>Position</th>
                  <th style={TH_RIGHT}>Change vs previous check</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((r, idx) => (
                  <HoverRow key={`${r.device}-${r.checkedAt}-${idx}`}>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>
                      {new Date(r.checkedAt).toLocaleDateString()}
                    </td>
                    {devices.length > 1 ? (
                      <td style={TD}>{DEVICE_STYLE[r.device].label}</td>
                    ) : null}
                    <td style={TD_NUM}>
                      {r.position === null ? (
                        <span style={{ color: "var(--text-3)" }}>
                          not in top {serpDepth}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>
                          {r.position}
                        </span>
                      )}
                    </td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <DeviceRankCell
                        result={{
                          position: r.position,
                          previousPosition: r.previousPosition,
                          rankingUrl: null,
                          serpFeatures: [],
                        }}
                      />
                    </td>
                  </HoverRow>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PanelBand>
  );
}

function TrendMessage({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--surface)",
        padding: "30px 16px",
        textAlign: "center",
        fontSize: 12.5,
        color: "var(--text-2)",
      }}
    >
      <div>{children}</div>
      {action ? <div style={{ marginTop: 10 }}>{action}</div> : null}
    </div>
  );
}

function TrendTooltip({
  label,
  entries,
  serpDepth,
  bottomBandKeys,
}: {
  label: number;
  entries: Array<{ dataKey?: string | number; value: number | null }>;
  serpDepth: number;
  bottomBandKeys: Set<string>;
}) {
  return (
    <ChartTooltipBox>
      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 3 }}>
        {new Date(label).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>
      {entries.map((e) => {
        const device =
          e.dataKey === "desktop" || e.dataKey === "mobile"
            ? DEVICE_STYLE[e.dataKey].label
            : String(e.dataKey ?? "");
        const inBottomBand = bottomBandKeys.has(`${label}:${e.dataKey}`);
        return (
          <div
            key={String(e.dataKey)}
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            {device}:{" "}
            {inBottomBand ? (
              <span style={{ color: "var(--text-2)", fontWeight: 400 }}>
                not in top {serpDepth}
              </span>
            ) : (
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {e.value}
              </span>
            )}
          </div>
        );
      })}
    </ChartTooltipBox>
  );
}
