import { NoValue } from "@/client/components/prominence/Primitives";
import { Skeleton } from "./RankScreenParts";
import type { computeScorecards } from "./rankTrackingScorecards";
import { formatCount } from "./rankFormat";

/**
 * The five headline numbers for the tracked set.
 *
 * Every value is gated on whether it was measured: a set with no completed
 * check shows the no-value marker in each cell, and a delta is only drawn when
 * a comparison check exists to draw it against.
 */

export function KpiStrip({
  isLoading,
  scorecards,
  total,
  serpDepth,
  deviceSuffix,
}: {
  isLoading: boolean;
  scorecards: ReturnType<typeof computeScorecards>;
  total: number;
  serpDepth: number;
  deviceSuffix: string;
}) {
  const measured = !isLoading && scorecards.measured;
  // A delta against a check that never happened is not a movement.
  const countDelta = (delta: number) =>
    measured && scorecards.comparable ? formatCountDelta(delta) : null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
        gap: 0,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <KpiCell
        label={`Top 3${deviceSuffix}`}
        divider
        isLoading={isLoading}
        value={measured ? formatCount(scorecards.top3) : null}
        delta={countDelta(scorecards.top3Delta)}
      />
      <KpiCell
        label={`Top 10${deviceSuffix}`}
        divider
        isLoading={isLoading}
        value={measured ? formatCount(scorecards.top10) : null}
        delta={countDelta(scorecards.top10Delta)}
      />
      <KpiCell
        label={`Top ${serpDepth}${deviceSuffix}`}
        divider
        isLoading={isLoading}
        value={measured ? formatCount(scorecards.ranking) : null}
        delta={countDelta(scorecards.rankingDelta)}
      />
      <KpiCell
        label={`Avg position${deviceSuffix}`}
        divider
        isLoading={isLoading}
        value={
          measured && scorecards.avgPosition !== null
            ? scorecards.avgPosition.toFixed(1)
            : null
        }
        delta={
          measured && scorecards.avgPositionDelta !== null
            ? positionDelta(scorecards.avgPositionDelta)
            : null
        }
      />
      <KpiCell
        label={`Not ranking${deviceSuffix}`}
        isLoading={isLoading}
        value={measured ? formatCount(scorecards.notRanking) : null}
        suffix={total > 0 ? `of ${formatCount(total)}` : undefined}
      />
    </div>
  );
}

/**
 * One metric. `value === null` means the number has not been measured, and the
 * cell says so with the design's own no-value marker — never a zero.
 */
function KpiCell({
  label,
  value,
  delta,
  suffix,
  divider,
  isLoading,
}: {
  label: string;
  value: string | null;
  delta?: { text: string; tone: "success" | "danger" | "muted" } | null;
  suffix?: string;
  divider?: boolean;
  isLoading: boolean;
}) {
  return (
    <div
      style={{
        padding: "11px 16px",
        borderRight: divider ? "1px solid var(--border-muted)" : undefined,
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        {isLoading ? (
          <Skeleton width={54} height={19} style={{ marginTop: 4 }} />
        ) : value === null ? (
          <NoValue />
        ) : (
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              letterSpacing: ".01em",
              fontSize: 19,
              fontWeight: 700,
            }}
          >
            {value}
          </span>
        )}
        {delta ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color:
                delta.tone === "success"
                  ? "var(--success)"
                  : delta.tone === "danger"
                    ? "var(--danger)"
                    : "var(--text-3)",
            }}
          >
            {delta.text}
          </span>
        ) : null}
        {suffix ? (
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

function formatCountDelta(delta: number) {
  if (delta === 0) return { text: "±0", tone: "muted" as const };
  return delta > 0
    ? { text: `+${delta}`, tone: "success" as const }
    : { text: `−${Math.abs(delta)}`, tone: "danger" as const };
}

/** Positive means the average moved up the page, which is an improvement. */
function positionDelta(delta: number) {
  const magnitude = Math.abs(delta).toFixed(1);
  if (magnitude === "0.0") return { text: "±0", tone: "muted" as const };
  return delta > 0
    ? { text: `↑ ${magnitude}`, tone: "success" as const }
    : { text: `↓ ${magnitude}`, tone: "danger" as const };
}
