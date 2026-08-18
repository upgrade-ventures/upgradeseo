import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  PageHeaderBand,
  SecondaryButton,
  Tab,
  TabStrip,
} from "@/client/components/prominence/Primitives";
import { TableExportMenu } from "@/client/components/table/TableBulkActionBar";
import {
  NoticeBand,
  PanelMessage,
  SkeletonRows,
} from "@/client/features/audit/AuditParts";
import { SCREEN_WRAP } from "@/client/features/audit/auditStyles";
import {
  CrawlStatusPill,
  extractHostname,
  formatAuditRef,
  formatDuration,
  formatStartedAt,
} from "@/client/features/audit/shared";
import { IssueDetailScreen } from "@/client/features/audit/issue/IssueDetailScreen";
import { CrawlHistoryPanel } from "@/client/features/audit/results/CrawlHistoryPanel";
import { CrawlProgressPanel } from "@/client/features/audit/results/CrawlProgressPanel";
import {
  exportIssues,
  exportPages,
  exportPerformance,
} from "@/client/features/audit/results/export";
import {
  IssuesPanel,
  type IssueFilter,
} from "@/client/features/audit/results/IssuesPanel";
import {
  groupIssues,
  type IssueGroup,
} from "@/client/features/audit/results/issueGrouping";
import { PagesPanel } from "@/client/features/audit/results/PagesPanel";
import { PerformancePanel } from "@/client/features/audit/results/PerformancePanel";
import type { AuditResultsData } from "@/client/features/audit/results/types";
import {
  findPreviousCrawl,
  useCrawlComparison,
  type AuditHistoryRow,
} from "@/client/features/audit/results/useCrawlComparison";

export type AuditTab = "issues" | "pages" | "performance" | "history";

type AuditStatus = {
  id: string;
  startUrl: string;
  status: string;
  pagesCrawled: number;
  pagesTotal: number;
  lighthouseTotal: number;
  lighthouseCompleted: number;
  lighthouseFailed: number;
  currentPhase: string | null;
  startedAt: string;
  completedAt: string | null;
};

const TABS: { key: AuditTab; label: string }[] = [
  { key: "issues", label: "Issues" },
  { key: "pages", label: "Pages" },
  { key: "performance", label: "Performance" },
  { key: "history", label: "Crawl history" },
];

export function AuditScreen({
  projectId,
  auditId,
  status,
  results,
  resultsLoading,
  resultsError,
  history,
  historyLoading,
  tab,
  onTabChange,
  onOpenAudit,
  onStartNewCrawl,
}: {
  projectId: string;
  auditId: string;
  status: AuditStatus;
  results: AuditResultsData | undefined;
  resultsLoading: boolean;
  resultsError: boolean;
  history: AuditHistoryRow[];
  historyLoading: boolean;
  tab: AuditTab;
  onTabChange: (tab: AuditTab) => void;
  onOpenAudit: (auditId: string) => void;
  onStartNewCrawl: () => void;
}) {
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  // The one navigation out of this screen in the design. It stays inside the
  // route so the sidebar keeps Site Audit selected, which is what the design
  // specifies for the issue screen.
  const [openIssue, setOpenIssue] = useState<IssueGroup | null>(null);

  const isRunning = status.status === "running";
  const isFailed = status.status === "failed";
  // A "completed" crawl that never got past the entry page is a silent
  // failure, and the operator should hear about it rather than read an empty
  // issue list as a clean bill of health.
  const isThinCrawl = status.status === "completed" && status.pagesCrawled <= 1;

  const previousCrawl = useMemo(
    () => findPreviousCrawl(history, auditId, status.startedAt),
    [auditId, history, status.startedAt],
  );
  const comparison = useCrawlComparison({
    projectId,
    previousAuditId: previousCrawl?.id ?? null,
    // The diff costs a second full result set, so it is only read once a view
    // that depends on it is actually open.
    enabled:
      tab === "issues" && (issueFilter === "new" || issueFilter === "fixed"),
  });

  const groups = useMemo(
    () => (results ? groupIssues(results.issues) : null),
    [results],
  );
  const currentSummary = useMemo(
    () =>
      groups
        ? {
            issueTypes: groups.length,
            critical: groups.filter((group) => group.severity === "critical")
              .length,
          }
        : null,
    [groups],
  );

  const blockedCount = useMemo(
    () =>
      results
        ? results.pages.filter((page) => page.fetchClass === "blocked").length
        : 0,
    [results],
  );

  const otherRunningCrawl = history.find(
    (crawl) => crawl.id !== auditId && crawl.status === "running",
  );

  const compareCrawls = () => {
    setOpenIssue(null);
    onTabChange("issues");
    setIssueFilter("new");
  };

  if (openIssue) {
    return (
      <IssueDetailScreen
        issues={openIssue.issues}
        onBack={() => setOpenIssue(null)}
      />
    );
  }

  return (
    <div style={SCREEN_WRAP}>
      <PageHeaderBand
        title={`Crawl of ${extractHostname(status.startUrl)}`}
        badge={
          // One flex item that can wrap internally. The header band's title row
          // does not wrap, so a two-part badge sitting there as two items would
          // overflow into the actions once the title is long enough.
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            <span
              title={auditId}
              style={{
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.01em",
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              {formatAuditRef(auditId)}
            </span>
            {/* A thin crawl completed but wants a decision, which is the
                vocabulary's Needs attention rather than Finished. */}
            <CrawlStatusPill
              status={status.status}
              needsAttention={isThinCrawl}
            />
          </span>
        }
        subtitle={describeCrawl(status, otherRunningCrawl)}
        actions={
          <>
            <SecondaryButton
              onClick={compareCrawls}
              disabled={previousCrawl === null}
              title={
                previousCrawl === null
                  ? "No earlier completed crawl to compare against"
                  : `Compare with ${formatAuditRef(previousCrawl.id)}`
              }
            >
              Compare crawls
            </SecondaryButton>
            <ExportMenu tab={tab} results={results} />
            <SecondaryButton icon="i-play" onClick={onStartNewCrawl}>
              New crawl
            </SecondaryButton>
          </>
        }
        tabs={
          <TabStrip>
            {TABS.map(({ key, label }) => (
              <Tab
                key={key}
                active={tab === key}
                controls={`audit-panel-${key}`}
                onClick={() => onTabChange(key)}
              >
                {label}
              </Tab>
            ))}
          </TabStrip>
        }
      />

      {isFailed ? (
        <NoticeBand
          tone="danger"
          title={
            status.pagesCrawled > 0
              ? `This crawl stopped early after ${status.pagesCrawled.toLocaleString()} ${status.pagesCrawled === 1 ? "page" : "pages"}.`
              : "This crawl could not read the site."
          }
        >
          Everything it reached before stopping is below. Bot protection is the
          usual cause: allowlist the UpgradeSEO-Audit user agent and run a new
          crawl, or email <SupportLink /> if it keeps happening.
        </NoticeBand>
      ) : null}

      {isThinCrawl ? (
        <NoticeBand
          tone="warning"
          title="This crawl only reached the first page."
        >
          The crawler found no further pages it could follow, which usually
          means a firewall or anti-bot rule turned it away. Email{" "}
          <SupportLink /> and we will help configure auditing for this site.
        </NoticeBand>
      ) : null}

      {blockedCount > 0 ? (
        <NoticeBand
          tone="warning"
          title={`We were blocked on ${blockedCount.toLocaleString()} ${blockedCount === 1 ? "page" : "pages"}.`}
        >
          The site&apos;s bot protection challenged our crawler, so those pages
          could not be audited. Allowlist the UpgradeSEO-Audit user agent in
          your WAF or bot-protection settings and run the crawl again.
        </NoticeBand>
      ) : null}

      <div
        id={`audit-panel-${tab}`}
        role="tabpanel"
        aria-label={TABS.find((entry) => entry.key === tab)?.label}
      >
        {tab === "history" ? (
          <CrawlHistoryPanel
            history={history}
            isLoading={historyLoading}
            currentAuditId={auditId}
            currentSummary={currentSummary}
            comparisonAuditId={previousCrawl?.id ?? null}
            onOpen={onOpenAudit}
            onCompare={compareCrawls}
          />
        ) : isRunning ? (
          <CrawlProgressPanel
            projectId={projectId}
            auditId={auditId}
            status={status}
          />
        ) : resultsError ? (
          <PanelMessage
            tone="danger"
            title="These results could not be loaded."
          >
            The crawl may have been deleted. Open another crawl from the
            history, or start a new one.
          </PanelMessage>
        ) : resultsLoading || !results ? (
          <SkeletonRows />
        ) : tab === "issues" ? (
          <IssuesPanel
            issues={results.issues}
            pagesCrawled={results.audit.pagesCrawled}
            filter={issueFilter}
            onFilterChange={setIssueFilter}
            comparison={comparison}
            previousCrawlLabel={
              previousCrawl ? formatAuditRef(previousCrawl.id) : null
            }
            onOpenIssue={setOpenIssue}
          />
        ) : tab === "pages" ? (
          <PagesPanel
            pages={results.pages}
            startUrl={results.audit.startUrl}
            issues={results.issues}
            lighthouse={results.lighthouse}
          />
        ) : (
          <PerformancePanel
            auditId={auditId}
            projectId={projectId}
            lighthouse={results.lighthouse}
            pages={results.pages}
          />
        )}
      </div>
    </div>
  );
}

function describeCrawl(
  status: AuditStatus,
  otherRunning: AuditHistoryRow | undefined,
): string {
  const parts: string[] = [];

  if (status.status === "running") {
    parts.push(
      status.pagesTotal > 0
        ? `${status.pagesCrawled.toLocaleString()} of ${status.pagesTotal.toLocaleString()} pages crawled so far`
        : `${status.pagesCrawled.toLocaleString()} pages crawled so far`,
    );
  } else {
    const duration = formatDuration(status.startedAt, status.completedAt);
    const pages = `${status.pagesCrawled.toLocaleString()} ${status.pagesCrawled === 1 ? "page" : "pages"} crawled`;
    parts.push(duration ? `${pages} in ${duration}` : pages);
  }

  parts.push(`started ${formatStartedAt(status.startedAt)}`);

  if (otherRunning) {
    const progress =
      otherRunning.pagesTotal > 0
        ? ` (${otherRunning.pagesCrawled.toLocaleString()} / ${otherRunning.pagesTotal.toLocaleString()})`
        : "";
    parts.push(`another crawl is running now${progress}`);
  }

  return parts.join(" · ");
}

function SupportLink() {
  return <Link to="/support">the support page</Link>;
}

/** Export of whatever the open tab is showing. Disabled until results exist. */
function ExportMenu({
  tab,
  results,
}: {
  tab: AuditTab;
  results: AuditResultsData | undefined;
}) {
  const run = (format: "csv" | "json" | "sheets") => {
    if (!results) return;
    if (tab === "performance") {
      exportPerformance(results.lighthouse, results.pages, format);
      return;
    }
    if (tab === "pages") {
      exportPages(results.pages, format);
      return;
    }
    exportIssues(results.issues, format);
  };

  const disabled = !results || tab === "history";

  return (
    <TableExportMenu
      // The shared menu trigger lays its icon, label and chevron out with a
      // gap utility, which needs a flex box to act on.
      buttonClassName="prominence-button-secondary inline-flex items-center gap-1.5"
      actions={[
        {
          label: "Export to Sheets",
          onClick: () => run("sheets"),
          disabled,
        },
        { label: "CSV", onClick: () => run("csv"), disabled },
        { label: "JSON", onClick: () => run("json"), disabled },
      ]}
    />
  );
}
