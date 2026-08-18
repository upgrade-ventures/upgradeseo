import type { RankTrackingRow } from "@/types/schemas/rank-tracking";

// Approximate organic CTR by position (index = position; aggregate industry
// curves). Only used to weight the visibility metric, so relative weights
// matter, not exact values. Positions past the list fall back to a small CTR.
const CTR_BY_POSITION = [
  0, 0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.033, 0.028, 0.024, 0.021, 0.018,
  0.016, 0.014, 0.012, 0.011, 0.01, 0.009, 0.008, 0.007, 0.006,
];
const TOP_CTR = CTR_BY_POSITION[1];

function ctr(position: number | null): number {
  if (position === null || position < 1) return 0;
  return CTR_BY_POSITION[position] ?? 0.005;
}

interface Scorecards {
  /**
   * Volume-weighted, CTR-weighted share of click potential captured (0–100):
   * Σ(volume × CTR@position) ÷ Σ(volume × CTR@1). null if no volume data.
   */
  visibility: number | null;
  /** change in visibility (percentage points) vs the comparison period */
  visibilityDelta: number | null;
  /** keywords currently ranking (found within the tracked depth) */
  ranking: number;
  /** change in ranking-keyword count vs the comparison period */
  rankingDelta: number;
  top3: number;
  top3Delta: number;
  top10: number;
  top10Delta: number;
  improved: number;
  declined: number;
  /** keywords with no position in the latest check */
  notRanking: number;
  /** mean of the positions that exist, null when nothing ranks */
  avgPosition: number | null;
  /**
   * Mean improvement in position, over the keywords ranked in BOTH checks.
   * Positive = moved up. Averaging the two periods separately would compare
   * different keyword sets and read as movement that never happened.
   */
  avgPositionDelta: number | null;
  /**
   * False when no keyword has a position in either check — nothing has been
   * measured yet, so every count above is an absence, not a zero.
   */
  measured: boolean;
  /**
   * False when no keyword has a comparison snapshot, which makes every delta
   * above a difference against nothing rather than a movement.
   */
  comparable: boolean;
}

/**
 * Portfolio scorecards from the already-loaded latest results for one device.
 * `ranking` counts keywords found within the tracked depth (a non-null
 * position) — unlike an average, it correctly drops when keywords fall out.
 * Improved/declined use the same 4-case null rules as DeviceRankCell: a "new"
 * entry counts as improved, a "lost" ranking counts as declined, and we never
 * subtract through a null.
 */
export function computeScorecards(
  rows: RankTrackingRow[],
  device: "desktop" | "mobile",
): Scorecards {
  let countCurrent = 0;
  let countPrevious = 0;
  let top3 = 0;
  let top3Previous = 0;
  let top10 = 0;
  let top10Previous = 0;
  let improved = 0;
  let declined = 0;
  let visNumCurrent = 0;
  let visNumPrevious = 0;
  let visVolume = 0; // Σ volume over keywords with known volume
  let positionSum = 0;
  let pairedDeltaSum = 0;
  let pairedCount = 0;

  for (const row of rows) {
    const { position, previousPosition } = row[device];

    if (position !== null) {
      countCurrent += 1;
      positionSum += position;
      if (position <= 3) top3 += 1;
      if (position <= 10) top10 += 1;
    }
    if (previousPosition !== null) {
      countPrevious += 1;
      if (previousPosition <= 3) top3Previous += 1;
      if (previousPosition <= 10) top10Previous += 1;
    }
    if (position !== null && previousPosition !== null) {
      pairedDeltaSum += previousPosition - position;
      pairedCount += 1;
    }

    if (row.searchVolume != null && row.searchVolume > 0) {
      visVolume += row.searchVolume;
      visNumCurrent += row.searchVolume * ctr(position);
      visNumPrevious += row.searchVolume * ctr(previousPosition);
    }

    // 4-case change classification (mirrors DeviceRankCell)
    if (position === null && previousPosition === null) {
      // nothing tracked — neither improved nor declined
    } else if (position === null) {
      declined += 1; // was ranking, now lost
    } else if (previousPosition === null) {
      improved += 1; // new entry
    } else if (previousPosition - position > 0) {
      improved += 1; // moved up
    } else if (previousPosition - position < 0) {
      declined += 1; // moved down
    }
  }

  const visibility =
    visVolume > 0 ? (visNumCurrent / (visVolume * TOP_CTR)) * 100 : null;
  const visibilityPrevious =
    visVolume > 0 ? (visNumPrevious / (visVolume * TOP_CTR)) * 100 : null;

  return {
    visibility,
    visibilityDelta:
      visibility !== null && visibilityPrevious !== null
        ? visibility - visibilityPrevious
        : null,
    ranking: countCurrent,
    rankingDelta: countCurrent - countPrevious,
    top3,
    top3Delta: top3 - top3Previous,
    top10,
    top10Delta: top10 - top10Previous,
    improved,
    declined,
    notRanking: rows.length - countCurrent,
    avgPosition: countCurrent > 0 ? positionSum / countCurrent : null,
    avgPositionDelta: pairedCount > 0 ? pairedDeltaSum / pairedCount : null,
    measured: countCurrent > 0 || countPrevious > 0,
    comparable: countPrevious > 0,
  };
}
