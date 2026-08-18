import type { CSSProperties } from "react";
import { toast } from "sonner";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import { captureClientEvent } from "@/client/lib/posthog";
import { formatLocationLabel } from "@/shared/keyword-locations";
import type {
  RankTrackingDeviceResult,
  RankTrackingRow,
} from "@/types/schemas/rank-tracking";

// The design writes SERP features out in full ("AI Overview", "People Also
// Ask"), so the chip carries the name rather than an initialism.
const FEATURE_LABELS: Record<string, string> = {
  featured_snippet: "Featured Snippet",
  people_also_ask: "People Also Ask",
  ai_overview: "AI Overview",
  local_pack: "Local Pack",
  knowledge_panel: "Knowledge Panel",
  video: "Video",
  images: "Images",
  shopping: "Shopping",
  top_stories: "Top Stories",
};

const FEATURE_TOOLTIPS: Record<string, string> = {
  featured_snippet:
    "Featured Snippet — highlighted answer box at top of results",
  people_also_ask: "People Also Ask — expandable related questions",
  ai_overview: "AI Overview — AI-generated summary at top of search",
  local_pack: "Local Pack — map with local business listings",
  knowledge_panel: "Knowledge Panel — info box about an entity",
  video: "Video — video results shown in the SERP",
  images: "Images — image results shown in the SERP",
  shopping: "Shopping — product listings with prices",
  top_stories: "Top Stories — news articles carousel",
};

/** Null for a feature we have no name for, so the chip is never a raw enum. */
export function serpFeatureLabel(feature: string): string | null {
  return FEATURE_LABELS[feature] ?? null;
}

export function serpFeatureTooltip(feature: string): string {
  return FEATURE_TOOLTIPS[feature] ?? feature;
}

const ARROW_ROW: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const FROM: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  letterSpacing: ".01em",
  fontSize: 11.5,
  color: "var(--text-3)",
  width: 24,
  textAlign: "right",
};

const TO: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  letterSpacing: ".01em",
  borderRadius: 5,
  padding: "0 5px",
  fontSize: 11,
  fontWeight: 600,
};

/**
 * "Where it was → where it is" for one device, in the four readings a check can
 * produce. Colour never carries the reading on its own: the lost case says the
 * word, and the rest show the position itself.
 */
export function DeviceRankCell({
  result,
}: {
  result: RankTrackingDeviceResult;
}) {
  const { position, previousPosition } = result;

  // Never measured on either check.
  if (position === null && previousPosition === null) {
    return <span style={{ color: "var(--text-3)" }}>—</span>;
  }

  // Was ranking, now absent from the tracked depth.
  if (position === null && previousPosition !== null) {
    return (
      <span style={ARROW_ROW}>
        <span style={FROM}>{previousPosition}</span>
        <span style={{ color: "var(--text-3)" }} aria-hidden>
          →
        </span>
        <span
          style={{
            ...TO,
            background: "var(--danger-soft)",
            color: "var(--danger)",
            border: "1px solid var(--danger-border)",
          }}
        >
          lost
        </span>
      </span>
    );
  }

  // First check for this device, so there is nothing to compare against.
  if (previousPosition === null) {
    return (
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          letterSpacing: ".01em",
        }}
      >
        {position}
      </span>
    );
  }

  const change = previousPosition - position!;
  const tone =
    change > 0
      ? {
          background: "var(--success-soft)",
          color: "var(--success)",
          border: "1px solid var(--success-border)",
        }
      : change < 0
        ? {
            background: "var(--warning-soft)",
            color: "var(--warning)",
            border: "1px solid var(--warning-border)",
          }
        : {
            background: "var(--inset)",
            color: "var(--text-2)",
            border: "1px solid var(--line)",
          };

  return (
    <span style={ARROW_ROW}>
      <span style={FROM}>{previousPosition}</span>
      <span style={{ color: "var(--text-3)" }} aria-hidden>
        →
      </span>
      <span
        style={{ ...TO, ...tone }}
        aria-label={
          change === 0
            ? `no change, position ${position}`
            : `${change > 0 ? "up" : "down"} ${Math.abs(change)}, now position ${position}`
        }
      >
        {position}
      </span>
    </span>
  );
}

/** Numeric change for CSV export — numbers bypass the CSV formula-injection sanitizer */
export function csvChange(
  current: number | null,
  previous: number | null,
): number | string {
  if (previous === null) return current !== null ? "new" : "";
  if (current === null) return "lost";
  return previous - current;
}

export function buildRankTrackingExport(
  sorted: RankTrackingRow[],
  showDesktop: boolean,
  showMobile: boolean,
  locationName?: string | null,
): { headers: string[]; rows: (string | number)[][] } {
  const headers = [
    "Keyword",
    // Exports lack the table's tooltip, so name the city inline.
    locationName
      ? `Local volume (${formatLocationLabel(locationName, 2)})`
      : "Volume",
    "KD",
    "CPC",
    ...(showDesktop
      ? [
          "Desktop Position",
          "Desktop Change",
          "Desktop URL",
          "Desktop SERP Features",
        ]
      : []),
    ...(showMobile
      ? [
          "Mobile Position",
          "Mobile Change",
          "Mobile URL",
          "Mobile SERP Features",
        ]
      : []),
  ];
  // Emit empty cells (not "Not ranking" strings) so Sheets infers a numeric
  // column type and the user can sort by position.
  const rows = sorted.map((row) => [
    row.keyword,
    row.searchVolume ?? "",
    row.keywordDifficulty ?? "",
    row.cpc ?? "",
    ...(showDesktop
      ? [
          row.desktop.position ?? "",
          csvChange(row.desktop.position, row.desktop.previousPosition),
          row.desktop.rankingUrl ?? "",
          row.desktop.serpFeatures.join(", "),
        ]
      : []),
    ...(showMobile
      ? [
          row.mobile.position ?? "",
          csvChange(row.mobile.position, row.mobile.previousPosition),
          row.mobile.rankingUrl ?? "",
          row.mobile.serpFeatures.join(", "),
        ]
      : []),
  ]);
  return { headers, rows };
}

export function exportRankTrackingToSheets(
  sorted: RankTrackingRow[],
  showDesktop: boolean,
  showMobile: boolean,
  locationName?: string | null,
) {
  const { headers, rows } = buildRankTrackingExport(
    sorted,
    showDesktop,
    showMobile,
    locationName,
  );
  void exportTableToSheets({ headers, rows, feature: "rank_tracking" });
}

export function exportRankTrackingCsv(
  sorted: RankTrackingRow[],
  showDesktop: boolean,
  showMobile: boolean,
  domain: string,
  locationName?: string | null,
) {
  if (sorted.length === 0) {
    toast.error("No data to export");
    return;
  }
  const { headers, rows } = buildRankTrackingExport(
    sorted,
    showDesktop,
    showMobile,
    locationName,
  );
  // CSV file download keeps cents-formatted CPC for human readability;
  // clipboard/Sheets export uses raw numbers (see buildRankTrackingExport).
  const csvRows = rows.map((row) =>
    row.map((cell, idx) =>
      idx === 3 && typeof cell === "number" ? cell.toFixed(2) : cell,
    ),
  );
  downloadCsv(`rank-tracking-${domain}.csv`, buildCsv(headers, csvRows));
  captureClientEvent("rank_tracking:export_csv");
}

export function toPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function toFullUrl(url: string, domain: string): string {
  if (url.startsWith("http")) return url;
  return `https://${domain}${url}`;
}
