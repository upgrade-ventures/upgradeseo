import { Icon } from "@/client/components/icons/IconSprite";

/**
 * The History tab.
 *
 * The design draws seven monthly bars of a domain's organic keyword count. That
 * series needs two things this product does not have: a ranked keyword count
 * for a third-party domain (no free source publishes one) and a stored monthly
 * snapshot of it. Nothing here is invented to fill the card — the chart frame
 * stays, and the plot area says what is missing and why.
 *
 * The caption is the design's own, and it is exactly the promise being kept:
 * months we did not measure are never backfilled with an estimate.
 */

const NO_SERIES_REASON =
  "Organic keyword counts for a domain you do not own need a licensed rank index, so there is nothing to snapshot yet. Search Console reports real history for your own verified site, on the Search performance screen.";

export function DomainHistoryTab({ domain }: { domain: string }) {
  return (
    <div style={{ padding: "16px var(--pad, 24px)", maxWidth: 760 }}>
      <section
        style={{
          border: "1px solid var(--line)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <h2
          style={{
            margin: 0,
            padding: "9px 12px",
            background: "var(--subtle)",
            borderBottom: "1px solid var(--line)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Organic keywords over time
        </h2>

        <div style={{ padding: "14px 12px" }}>
          {/* Same 110px plot box the bars would occupy, so switching to this
              tab never shifts the card's height once a series does exist. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              height: 110,
              border: "1px dashed var(--line)",
              borderRadius: 6,
              background: "var(--subtle)",
              padding: "0 14px",
              textAlign: "center",
            }}
          >
            <span style={{ color: "var(--text-3)", display: "flex" }}>
              <Icon name="i-chart" size={18} />
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--text-2)",
              }}
            >
              No monthly snapshots for {domain}
            </p>
          </div>
        </div>

        <p
          style={{
            display: "flex",
            gap: 18,
            margin: 0,
            padding: "10px 12px",
            borderTop: "1px solid var(--border-muted)",
            fontSize: 12.5,
            color: "var(--text-2)",
            flexWrap: "wrap",
          }}
        >
          {NO_SERIES_REASON}
        </p>
      </section>

      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-2)" }}>
        Monthly snapshots, taken on the 1st. We never backfill estimates for
        months we did not measure.
      </p>
    </div>
  );
}
