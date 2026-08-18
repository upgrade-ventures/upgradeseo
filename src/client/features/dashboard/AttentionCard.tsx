import { Link } from "@tanstack/react-router";
import { Icon } from "@/client/components/icons/IconSprite";
import {
  Card,
  InfoNote,
  StatusPill,
} from "@/client/components/prominence/Primitives";
import { getIssueDescriptor } from "@/shared/audit-issues";
import type { DashboardAuditSummary } from "@/server/features/dashboard/services/DashboardService";

/**
 * "What needs me right now" — the design's impact-sorted attention list.
 *
 * Rows come straight from the latest crawl's issue types, which the dashboard
 * service already ranks by severity then affected-page count. Nothing here is
 * scored or estimated by the UI; the ordering is the server's.
 */
export function AttentionCard({
  projectId,
  audit,
  loading,
}: {
  projectId: string;
  audit: DashboardAuditSummary | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card title="Needs attention" note="Sorted by impact">
        <div style={{ padding: "4px 0" }} aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div key={row} style={ROW}>
              <span style={{ ...DOT, background: "var(--inset)" }} />
              <span
                style={{
                  height: 12,
                  width: 220,
                  borderRadius: 4,
                  background: "var(--inset)",
                  animation: "shimmer 1.4s ease-in-out infinite",
                }}
              />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // No crawl yet is a different state from a clean crawl, and the difference
  // matters: one needs an action, the other is good news.
  if (!audit) {
    return (
      <Card title="Needs attention">
        <div style={{ padding: "12px 12px 14px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            No crawl yet
          </p>
          <InfoNote>
            Run a site audit and the issues worth fixing first show up here.
          </InfoNote>
        </div>
      </Card>
    );
  }

  const issues = audit.topIssues;
  if (issues.length === 0) {
    return (
      <Card title="Needs attention">
        <div style={{ padding: "12px 12px 14px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            Nothing needs attention
          </p>
          <InfoNote>
            The last crawl of {audit.pagesCrawled.toLocaleString()} pages found
            no issues.
          </InfoNote>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Needs attention"
      count={audit.totalIssueTypes}
      note="Sorted by impact"
    >
      <div>
        {issues.map((issue) => {
          const descriptor = getIssueDescriptor(issue.issueType);
          return (
            <Link
              key={issue.issueType}
              to="/p/$projectId/audit"
              params={{ projectId }}
              search={{ tab: "issues" as const }}
              className="prominence-attention-row"
              style={ROW}
            >
              <span style={{ ...DOT, background: SEVERITY[issue.severity] }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {descriptor?.title ?? issue.issueType}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    color: "var(--text-2)",
                  }}
                >
                  {issue.count.toLocaleString()}{" "}
                  {issue.count === 1 ? "page" : "pages"} affected
                </span>
              </span>
              <StatusPill tone={PILL[issue.severity]}>
                {LABEL[issue.severity]}
              </StatusPill>
              <Icon name="i-chev-right" size={14} />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 12px",
  borderBottom: "1px solid var(--border-muted)",
  color: "inherit",
  textDecoration: "none",
};

const DOT: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
};

const SEVERITY = {
  critical: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
} as const;

const PILL = {
  critical: "danger",
  warning: "warning",
  info: "info",
} as const;

const LABEL = {
  critical: "Critical",
  warning: "Warning",
  info: "Notice",
} as const;
