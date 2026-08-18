import { useQuery } from "@tanstack/react-query";
import { getCrawlProgress } from "@/serverFunctions/audit";
import {
  extractPathname,
  HttpStatusBadge,
} from "@/client/features/audit/shared";
import { NARROW_PANEL } from "@/client/features/audit/auditStyles";
import { JobProgressRow } from "@/client/components/prominence/JobStates";

type ProgressStatus = {
  pagesCrawled: number;
  pagesTotal: number;
  lighthouseTotal: number;
  lighthouseCompleted: number;
  lighthouseFailed: number;
  currentPhase: string | null;
};

const PHASE_LABEL: Record<string, string> = {
  discovery: "Discovery",
  crawling: "Crawling",
  lighthouse: "Lighthouse",
  finalizing: "Finalizing",
};

/**
 * What a crawl in flight shows.
 *
 * The running row is the Dashboard's "In progress" card verbatim, through the
 * shared `JobProgressRow`: a live count of what is done so far, a 4px track,
 * and the sentence that says leaving the page is safe. The tail of crawled URLs
 * below it is this screen's own, since a thousand-page crawl needs something to
 * watch.
 */
export function CrawlProgressPanel({
  projectId,
  auditId,
  status,
}: {
  projectId: string;
  auditId: string;
  status: ProgressStatus;
}) {
  const isLighthousePhase = status.currentPhase === "lighthouse";
  const lighthouseDone = status.lighthouseCompleted + status.lighthouseFailed;
  const done = isLighthousePhase ? lighthouseDone : status.pagesCrawled;
  const total = isLighthousePhase ? status.lighthouseTotal : status.pagesTotal;

  const progressQuery = useQuery({
    queryKey: ["audit-crawl-progress", projectId, auditId],
    queryFn: () => getCrawlProgress({ data: { projectId, auditId } }),
    refetchInterval: 1500,
  });
  const crawled = progressQuery.data ?? [];

  return (
    <div style={NARROW_PANEL}>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <JobProgressRow
          name={
            isLighthousePhase ? "Running Lighthouse checks" : "Crawling pages"
          }
          reference={
            PHASE_LABEL[status.currentPhase ?? ""] ??
            status.currentPhase ??
            null
          }
          status="running"
          done={done}
          // Zero is not "no pages": it is the crawl still counting what it can
          // reach, so the row says so rather than drawing an empty bar.
          total={total > 0 ? total : null}
          unit={isLighthousePhase ? "checks" : "pages"}
          note={
            isLighthousePhase && status.lighthouseFailed > 0
              ? `${status.lighthouseFailed.toLocaleString()} could not be scored. You can leave this page — the run carries on without you.`
              : "You can leave this page — the run carries on without you."
          }
        />
      </div>

      {crawled.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            border: "1px solid var(--line)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "9px 12px",
              background: "var(--subtle)",
              borderBottom: "1px solid var(--line)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Just crawled
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {crawled.map((entry) => (
              <div
                key={`${entry.url}-${entry.crawledAt}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 12px",
                  borderBottom: "1px solid var(--border-muted)",
                  fontSize: 12.5,
                }}
              >
                <HttpStatusBadge code={entry.statusCode} />
                <span
                  title={entry.url}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {extractPathname(entry.url)}
                </span>
                {entry.title ? (
                  <span
                    title={entry.title}
                    style={{
                      color: "var(--text-3)",
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.title}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
