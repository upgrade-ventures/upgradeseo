import type { RankKeywordHistoryPoint } from "@/serverFunctions/rank-tracking";

/**
 * Shaping for one keyword's position history: the flat per-check rows the
 * server returns, turned into the two shapes the panel draws from.
 */

export function deriveDevices(
  points: RankKeywordHistoryPoint[],
): Array<"desktop" | "mobile"> {
  const present = new Set(points.map((p) => p.device));
  return (["desktop", "mobile"] as const).filter((d) => present.has(d));
}

interface ChartRow extends Record<string, unknown> {
  checkedAt: number;
  desktop?: number;
  mobile?: number;
}

/**
 * Pivot flat rows into chart rows keyed by checkedAt (ms). A null position is
 * plotted at `serpDepth` so it renders inside the muted bottom band and the
 * line connects down to it (a drop), rather than leaving a silent gap.
 */
export function buildChartData(
  points: RankKeywordHistoryPoint[],
  serpDepth: number,
): ChartRow[] {
  const byTime = new Map<number, ChartRow>();
  for (const p of points) {
    const ts = new Date(p.checkedAt).getTime();
    const row = byTime.get(ts) ?? { checkedAt: ts };
    row[p.device] = p.position === null ? serpDepth : p.position;
    byTime.set(ts, row);
  }
  return [...byTime.values()].toSorted((a, b) => a.checkedAt - b.checkedAt);
}

interface HistoryRow {
  device: "desktop" | "mobile";
  checkedAt: string;
  position: number | null;
  previousPosition: number | null;
}

/**
 * One row per snapshot (newest first) with the previous-check position for the
 * same device, so the change column can reuse DeviceRankCell's 4-case logic.
 */
export function buildHistoryRows(
  points: RankKeywordHistoryPoint[],
): HistoryRow[] {
  const prevByDevice = new Map<"desktop" | "mobile", number | null>();
  const rows: HistoryRow[] = [];
  // points are oldest-first; walk forward to capture the prior position.
  for (const p of points) {
    const hadPrevious = prevByDevice.has(p.device);
    rows.push({
      device: p.device,
      checkedAt: p.checkedAt,
      position: p.position,
      previousPosition: hadPrevious
        ? (prevByDevice.get(p.device) ?? null)
        : null,
    });
    prevByDevice.set(p.device, p.position);
  }
  return rows.toReversed();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
