import { NoValue } from "@/client/components/prominence/Primitives";
import {
  formatCount,
  formatCtr,
  formatPosition,
  type Report,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import { SkeletonBar } from "@/client/features/search-performance/SearchPerformanceTable";

/**
 * The four headline Search Console metrics, drawn as the design's full-bleed
 * divided strip rather than as separate tiles.
 *
 * Every figure is Google's own measurement for the selected range. Where the
 * previous period returned no impressions there is nothing to compare against,
 * so the delta and the "was" line are withheld instead of printing a zero,
 * which would read as a measured collapse rather than as no measurement.
 */

type Totals = Report["totals"];
type Delta = { text: string; tone: "success" | "danger" } | null;

export function MetricStrip({
  totals,
  prevTotals,
  comparisonTitle,
}: {
  totals: Totals | null;
  prevTotals: Totals | null;
  /** Exact previous-period dates, surfaced on hover over the "was" line. */
  comparisonTitle?: string;
}) {
  // GSC returns zero-filled totals for a range it has no rows for, so
  // impressions is the only honest test of "was this period measured at all".
  // Nothing measured means every figure is unavailable: printing "0 clicks"
  // would report a collapse Google never actually observed.
  const measured = totals != null && totals.impressions > 0 ? totals : null;
  const before =
    prevTotals != null && prevTotals.impressions > 0 ? prevTotals : null;
  // The reason sits on each tile, since the design does not repeat a
  // section-level explanation under four cards.
  const note =
    totals != null && measured == null
      ? "no data in this period"
      : "no earlier period measured";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <MetricCell
        divider
        label="Clicks"
        value={figure(totals, measured, (t) => formatCount(t.clicks))}
        delta={
          measured && before
            ? percentDelta(measured.clicks, before.clicks)
            : null
        }
        previous={before ? `was ${formatCount(before.clicks)}` : null}
        note={note}
        comparisonTitle={comparisonTitle}
      />
      <MetricCell
        divider
        label="Impressions"
        value={figure(totals, measured, (t) => formatCount(t.impressions))}
        delta={
          measured && before
            ? percentDelta(measured.impressions, before.impressions)
            : null
        }
        previous={before ? `was ${formatCount(before.impressions)}` : null}
        note={note}
        comparisonTitle={comparisonTitle}
      />
      <MetricCell
        divider
        label="CTR"
        // CTR is clicks/impressions: with no impressions it is undefined, not 0.
        value={figure(totals, measured, (t) => formatCtr(t.ctr))}
        delta={measured && before ? pointDelta(measured.ctr, before.ctr) : null}
        previous={before ? `was ${formatCtr(before.ctr)}` : null}
        note={note}
        comparisonTitle={comparisonTitle}
      />
      <MetricCell
        label="Avg position"
        value={figure(totals, measured, (t) => formatPosition(t.position))}
        delta={
          measured && before
            ? positionDelta(measured.position, before.position)
            : null
        }
        previous={before ? `was ${formatPosition(before.position)}` : null}
        note={note}
        comparisonTitle={comparisonTitle}
      />
    </div>
  );
}

/**
 * One tile's figure: the formatted number, the design's unavailable marker when
 * Google measured nothing, or null while the report is still in flight (which
 * draws the skeleton).
 */
function figure(
  totals: Totals | null,
  measured: Totals | null,
  read: (totals: Totals) => string,
): React.ReactNode | null {
  if (totals == null) return null;
  return measured ? read(measured) : <NoValue />;
}

function MetricCell({
  label,
  value,
  delta,
  previous,
  note,
  divider,
  comparisonTitle,
}: {
  label: string;
  /** null while the report is still loading. */
  value: React.ReactNode | null;
  delta: Delta;
  previous: string | null;
  /** Third line when there is no previous figure to name. */
  note: string;
  divider?: boolean;
  comparisonTitle?: string;
}) {
  return (
    <div
      style={{
        padding: "13px 20px",
        borderRight: divider ? "1px solid var(--border-muted)" : undefined,
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.01em",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {value ?? <SkeletonBar width={72} height={18} />}
        </span>
        {delta ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color:
                delta.tone === "danger" ? "var(--danger)" : "var(--success)",
            }}
          >
            {delta.text}
          </span>
        ) : null}
      </div>
      <div
        style={{ fontSize: 11.5, color: "var(--text-3)" }}
        title={previous ? comparisonTitle : undefined}
      >
        {value == null ? (
          <SkeletonBar width={64} height={10} />
        ) : (
          (previous ?? note)
        )}
      </div>
    </div>
  );
}

function percentDelta(current: number, previous: number): Delta {
  // No baseline means no percentage; dividing by zero would print Infinity.
  if (previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  return {
    text: `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`,
    tone: change >= 0 ? "success" : "danger",
  };
}

/** CTR moves in percentage POINTS, not percent. The design writes "pt". */
function pointDelta(current: number, previous: number): Delta {
  const points = (current - previous) * 100;
  return {
    text: `${points >= 0 ? "+" : "−"}${Math.abs(points).toFixed(1)}pt`,
    tone: points >= 0 ? "success" : "danger",
  };
}

/** A smaller position is a better rank, so a fall in the number is a rise. */
function positionDelta(current: number, previous: number): Delta {
  const change = previous - current;
  if (Math.abs(change) < 0.05) return null;
  const improved = change > 0;
  return {
    text: `${improved ? "↑" : "↓"} ${Math.abs(change).toFixed(1)}`,
    tone: improved ? "success" : "danger",
  };
}
