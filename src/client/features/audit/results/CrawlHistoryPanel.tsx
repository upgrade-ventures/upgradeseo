import {
  PanelFootnote,
  PanelMessage,
  Skeleton,
  SmallGhostButton,
} from "@/client/features/audit/AuditParts";
import { NARROW_PANEL } from "@/client/features/audit/auditStyles";
import {
  JobStatusPill,
  runJobState,
} from "@/client/components/prominence/JobStatus";
import {
  formatAuditRef,
  formatRelativeTime,
  formatStartedAt,
} from "@/client/features/audit/shared";
import type { AuditHistoryRow } from "@/client/features/audit/results/useCrawlComparison";

/* A crawl's state is drawn by the shared status pill, so this list says
   Running / Finished / Failed in exactly the words every other screen uses. */

/**
 * Every crawl of this project, current one included.
 *
 * The design's meta line quotes an issue-type and critical count per crawl. The
 * history endpoint carries neither, and reading them would mean loading every
 * crawl's full result set, so only the crawl being viewed shows them — the rest
 * show what was actually recorded.
 */
export function CrawlHistoryPanel({
  history,
  isLoading,
  currentAuditId,
  currentSummary,
  onOpen,
  onCompare,
  comparisonAuditId,
}: {
  history: AuditHistoryRow[];
  isLoading: boolean;
  currentAuditId: string;
  currentSummary: { issueTypes: number; critical: number } | null;
  onOpen: (auditId: string) => void;
  onCompare: () => void;
  /** The crawl the "new" and "fixed" issue views diff against, if any. */
  comparisonAuditId: string | null;
}) {
  if (isLoading) {
    return (
      <div style={NARROW_PANEL}>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px",
                borderBottom:
                  index === 2 ? undefined : "1px solid var(--border-muted)",
              }}
            >
              <Skeleton width={7} height={7} style={{ borderRadius: 999 }} />
              <div style={{ flex: 1 }}>
                <Skeleton width="34%" height={12} />
                <Skeleton width="56%" height={10} style={{ marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <PanelMessage title="No crawls recorded for this project.">
        Start a crawl to build a history you can compare against.
      </PanelMessage>
    );
  }

  return (
    <div style={NARROW_PANEL}>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {history.map((crawl, index) => (
          <div
            key={crawl.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderBottom:
                index === history.length - 1
                  ? undefined
                  : "1px solid var(--border-muted)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span title={crawl.id}>{formatAuditRef(crawl.id)}</span>
                <JobStatusPill state={runJobState(crawl.status)} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                {describeCrawl(
                  crawl,
                  crawl.id === currentAuditId ? currentSummary : null,
                )}
              </div>
            </div>
            {crawl.id === currentAuditId ? (
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                Current
              </span>
            ) : crawl.id === comparisonAuditId ? (
              <SmallGhostButton
                onClick={onCompare}
                title="Show the issue types that changed since this crawl"
              >
                Compare
              </SmallGhostButton>
            ) : (
              <SmallGhostButton muted onClick={() => onOpen(crawl.id)}>
                Open
              </SmallGhostButton>
            )}
          </div>
        ))}
      </div>
      <PanelFootnote>
        Crawl references are the first segment of each run&apos;s id. Hover a
        reference for the full value.
      </PanelFootnote>
    </div>
  );
}

function describeCrawl(
  crawl: AuditHistoryRow,
  summary: { issueTypes: number; critical: number } | null,
): string {
  const parts: string[] = [];

  if (crawl.status === "running") {
    parts.push(`Started ${formatRelativeTime(crawl.startedAt)}`);
    parts.push(
      crawl.pagesTotal > 0
        ? `${crawl.pagesCrawled.toLocaleString()} of ${crawl.pagesTotal.toLocaleString()} pages`
        : `${crawl.pagesCrawled.toLocaleString()} pages so far`,
    );
    return parts.join(" · ");
  }

  parts.push(formatStartedAt(crawl.startedAt));
  parts.push(
    crawl.status === "failed"
      ? `stopped at ${crawl.pagesCrawled.toLocaleString()} ${crawl.pagesCrawled === 1 ? "page" : "pages"}`
      : `${crawl.pagesCrawled.toLocaleString()} ${crawl.pagesCrawled === 1 ? "page" : "pages"}`,
  );
  if (summary) {
    parts.push(
      `${summary.issueTypes.toLocaleString()} issue ${summary.issueTypes === 1 ? "type" : "types"}`,
    );
    parts.push(`${summary.critical.toLocaleString()} critical`);
  }
  if (crawl.ranLighthouse) parts.push("Lighthouse");
  return parts.join(" · ");
}
