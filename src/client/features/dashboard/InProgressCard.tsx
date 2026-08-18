import { Icon } from "@/client/components/icons/IconSprite";
import { Card } from "@/client/components/prominence/Primitives";
import type { DashboardAuditSummary } from "@/server/features/dashboard/services/DashboardService";

/**
 * The design's "what is the app doing for me right now" panel.
 *
 * Only rendered while something is genuinely in flight. The design shows a
 * running crawl beside a queued rank check as a permanent fixture; here the card
 * disappears when nothing is running, because a panel that always claims work is
 * happening is worse than no panel.
 */
export function InProgressCard({
  audit,
  rankRunning,
}: {
  audit: DashboardAuditSummary | null;
  rankRunning: boolean;
}) {
  const auditRunning = audit?.status === "running";
  if (!auditRunning && !rankRunning) return null;

  return (
    <Card title="In progress">
      <div>
        {auditRunning ? (
          <div style={ROW}>
            <Spinner />
            <Icon name="i-clipboard" size={14} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
              <span style={{ fontWeight: 600 }}>Site crawl</span>
              <span style={{ color: "var(--text-2)" }}>
                {" · "}
                {audit.pagesCrawled > 0
                  ? `${audit.pagesCrawled.toLocaleString()} pages so far`
                  : "starting"}
              </span>
            </span>
          </div>
        ) : null}

        {rankRunning ? (
          <div style={ROW}>
            <Spinner />
            <Icon name="i-trend" size={14} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
              <span style={{ fontWeight: 600 }}>Rank check</span>
              <span style={{ color: "var(--text-2)" }}> · running</span>
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** The design's spin keyframe is declared once in prominence.css. */
function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 11,
        height: 11,
        flexShrink: 0,
        borderRadius: 999,
        border: "1.5px solid var(--accent-border)",
        borderTopColor: "var(--accent)",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 12px",
  borderBottom: "1px solid var(--border-muted)",
};
