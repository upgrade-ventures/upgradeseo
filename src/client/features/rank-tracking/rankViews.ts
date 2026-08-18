import type { RankTrackingRow } from "@/types/schemas/rank-tracking";

/**
 * The saved views from the design's views bar.
 *
 * In the design these only raise a toast; here each one is a real filter over
 * the loaded rows, evaluated against the comparison snapshot the results query
 * already returns. A row qualifies when ANY tracked device qualifies, so a
 * both-devices set never hides a keyword that moved on mobile only.
 *
 * "all" is not in the design. It is here because the design's three views are
 * mutually exclusive and always one is on, which would mean the screen never
 * shows the full tracked set — a feature the current screen has.
 */
export type RankView = "all" | "movers" | "page2" | "lost";

export const RANK_VIEWS: { id: RankView; label: string; help: string }[] = [
  {
    id: "all",
    label: "All keywords",
    help: "Every keyword tracked in this set",
  },
  {
    id: "movers",
    label: "Movers",
    help: "Keywords whose position changed since the comparison check",
  },
  {
    id: "page2",
    label: "Page 2 opportunities",
    help: "Positions 11 to 20, closest to the first page",
  },
  {
    id: "lost",
    label: "Lost from top 10",
    help: "Ranked in the top 10 at the comparison check, not now",
  },
];

export type TrackedDevice = "desktop" | "mobile";

function matches(
  row: RankTrackingRow,
  view: RankView,
  device: TrackedDevice,
): boolean {
  const { position, previousPosition } = row[device];
  if (view === "page2") {
    return position !== null && position >= 11 && position <= 20;
  }
  // Both remaining views compare against the earlier check, so a keyword with
  // no comparison snapshot is unknown rather than unchanged, and drops out.
  if (previousPosition === null) return false;
  if (view === "movers") return position !== previousPosition;
  return previousPosition <= 10 && (position === null || position > 10);
}

export function applyRankView(
  rows: RankTrackingRow[],
  view: RankView,
  devices: TrackedDevice[],
): RankTrackingRow[] {
  if (view === "all") return rows;
  return rows.filter((row) =>
    devices.some((device) => matches(row, view, device)),
  );
}
