import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import {
  PageHeaderBand,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  Tab,
  TabStrip,
  type PillTone,
} from "@/client/components/prominence/Primitives";
import { useShellBreakpoint } from "@/client/layout/useShellBreakpoint";
import { exportIssues } from "@/client/features/audit/results/export";
import { AffectedPagesTable } from "@/client/features/audit/issue/IssueAffectedTable";
import {
  affectedColumns,
  InfoStrip,
  IssueAside,
  LinkButton,
  parseRowDetails,
  SEVERITY_COLOR,
  shortCrawlId,
  TimelineItem,
  WhatThisMeansCallout,
  type AuditIssueRow,
} from "@/client/features/audit/issue/IssueDetailParts";
import { getIssueDescriptor, type IssueSeverity } from "@/shared/audit-issues";

type IssueTab = "affected" | "fix" | "history";

const TABS: { id: IssueTab; label: string }[] = [
  { id: "affected", label: "Affected pages" },
  { id: "fix", label: "How to fix" },
  { id: "history", label: "History" },
];

const SEVERITY_TONE: Record<IssueSeverity, PillTone> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Notice",
};

/** Rows the design shows before "show the rest". */
const INITIAL_ROWS = 5;
/** Ceiling the issues list already used, kept so a 4,000-row group cannot
 *  freeze the tab. Past it, the CSV is the complete answer. */
const MAX_RENDERED_ROWS = 100;

/**
 * One site-audit issue type, in detail: which pages carry it, what it costs,
 * how to fix it.
 *
 * The design draws this for a broken internal link with a fixed 12-page fixture.
 * Here it is driven by the crawl's own `audit_issues` rows, so anything the
 * crawl does not record (link anchor text, an issue's life across crawls, a fix
 * effort rating) is marked unavailable rather than filled in.
 */
export function IssueDetailScreen({
  issues,
  onBack,
}: {
  /** Every issue row of one issue type, from one crawl. */
  issues: AuditIssueRow[];
  onBack: () => void;
}) {
  const [tab, setTab] = useState<IssueTab>("affected");
  const [expanded, setExpanded] = useState(false);
  // The design's breakpoints are measured on the app root, not on this screen's
  // own box; an unattached ref makes the hook fall back to the window width,
  // which is the same measurement here.
  const shellRef = useRef<HTMLElement>(null);
  const { mid } = useShellBreakpoint(shellRef);

  const first = issues[0];
  const issueType = first.issueType;
  const descriptor = getIssueDescriptor(issueType);
  const severity: IssueSeverity =
    descriptor?.severity ??
    (first.severity === "critical" || first.severity === "warning"
      ? first.severity
      : "info");
  const title = descriptor?.title ?? issueType;

  const rows = useMemo(
    () =>
      issues.map((issue) => ({
        issue,
        details: parseRowDetails(issue.detailsJson),
      })),
    [issues],
  );
  const columns = useMemo(() => affectedColumns(rows), [rows]);

  const total = rows.length;
  const pages = `${total} ${total === 1 ? "page" : "pages"}`;
  const visible = rows.slice(0, expanded ? MAX_RENDERED_ROWS : INITIAL_ROWS);

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = TABS.findIndex((entry) => entry.id === tab);
    const next = TABS[(index + step + TABS.length) % TABS.length];
    setTab(next.id);
    const buttons =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[TABS.indexOf(next)]?.focus();
  };

  const exportUrls = () => {
    exportIssues(issues, "csv");
    toast.success(`Exported ${total} ${total === 1 ? "URL" : "URLs"} to CSV`);
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* The design puts the back link inside the header band, 9px above the
          title. PageHeaderBand owns an 18px lead-in, so the link sits above it
          and pulls the band back up by the difference. */}
      <div style={{ padding: "14px var(--pad, 24px) 0", marginBottom: -9 }}>
        <LinkButton onClick={onBack}>← Back to issues</LinkButton>
      </div>

      <PageHeaderBand
        title={
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 9 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: SEVERITY_COLOR[severity].fg,
              }}
            />
            {title}
          </span>
        }
        badge={
          <StatusPill tone={SEVERITY_TONE[severity]}>
            {SEVERITY_LABEL[severity]}
          </StatusPill>
        }
        subtitle={
          <>
            {pages} affected · found in crawl{" "}
            <span
              title={first.auditId}
              style={{
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.01em",
              }}
            >
              {shortCrawlId(first.auditId)}
            </span>
          </>
        }
        actions={
          <>
            <SecondaryButton onClick={exportUrls}>
              Export {total} {total === 1 ? "URL" : "URLs"}
            </SecondaryButton>
            <PrimaryButton onClick={() => setTab("fix")}>
              Open the fix guide
            </PrimaryButton>
          </>
        }
        tabs={
          <div onKeyDown={onTabKeyDown}>
            <TabStrip>
              {TABS.map((entry) => (
                <Tab
                  key={entry.id}
                  active={tab === entry.id}
                  controls={`issue-panel-${entry.id}`}
                  onClick={() => setTab(entry.id)}
                >
                  {entry.label}
                </Tab>
              ))}
            </TabStrip>
          </div>
        }
      />

      {tab === "affected" ? (
        <div
          id="issue-panel-affected"
          role="tabpanel"
          aria-label="Affected pages"
          style={{
            display: "grid",
            gridTemplateColumns: mid
              ? "minmax(0, 1fr)"
              : "minmax(360px, 1fr) minmax(240px, 320px)",
            alignItems: "start",
          }}
        >
          <div>
            {descriptor?.explanation ? (
              <WhatThisMeansCallout
                severity={severity}
                explanation={descriptor.explanation}
              />
            ) : null}
            <AffectedPagesTable rows={visible} columns={columns} />
            <div
              style={{
                padding: "10px var(--pad, 24px)",
                fontSize: 12,
                color: "var(--text-2)",
                borderTop: "1px solid var(--line)",
              }}
            >
              {visible.length >= total ? (
                <>Showing all {pages}</>
              ) : expanded ? (
                <>
                  Showing {visible.length} of {total} · export the CSV for the
                  full list
                </>
              ) : (
                <>
                  Showing {visible.length} of {total} ·{" "}
                  <LinkButton onClick={() => setExpanded(true)}>
                    show the rest
                  </LinkButton>
                </>
              )}
              {columns.anchor ? (
                <div style={{ marginTop: 4, color: "var(--text-3)" }}>
                  Link anchor text is not kept after the crawl finishes, so this
                  report cannot show which words carry each broken link.
                </div>
              ) : null}
            </div>
          </div>

          <IssueAside
            stacked={mid}
            severity={severity}
            pageCount={total}
            crawlId={first.auditId}
          >
            <TimelineItem
              variant="aside"
              color={SEVERITY_COLOR[severity].fg}
              label={`Detected · ${pages}`}
              last
            />
            <div
              style={{
                marginTop: 8,
                fontSize: 11.5,
                color: "var(--text-3)",
              }}
            >
              Earlier crawls are not linked to this issue.
            </div>
          </IssueAside>
        </div>
      ) : null}

      {tab === "fix" ? (
        <div
          id="issue-panel-fix"
          role="tabpanel"
          aria-label="How to fix"
          style={{ padding: "16px var(--pad, 24px)", maxWidth: 720 }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            How to fix: {title}
          </h2>
          <p
            style={{
              margin: "9px 0 0",
              fontSize: 12.5,
              color: "var(--text-2)",
              lineHeight: 1.7,
            }}
          >
            {descriptor?.howToFix ??
              "This issue type has no fix guide yet. The affected pages tab lists everything the crawl recorded about it."}
          </p>
          {descriptor?.explanation ? (
            <div
              style={{
                marginTop: 14,
                padding: "11px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--subtle)",
                fontSize: 12.5,
                color: "var(--text-2)",
              }}
            >
              <strong style={{ color: "var(--text)", fontWeight: 600 }}>
                Why this matters.
              </strong>{" "}
              {descriptor.explanation}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
            }}
          >
            <SecondaryButton onClick={exportUrls}>
              Export the {total} {total === 1 ? "URL" : "URLs"}
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div id="issue-panel-history" role="tabpanel" aria-label="History">
          <div style={{ padding: "14px var(--pad, 24px)" }}>
            <TimelineItem
              variant="tab"
              color={SEVERITY_COLOR[severity].fg}
              label={`Detected in this crawl · ${pages} affected`}
              meta={`Crawl ${shortCrawlId(first.auditId)}`}
              last
            />
          </div>
          <InfoStrip>
            Every crawl records its own issues, and UpgradeSEO does not yet
            carry one issue from crawl to crawl. Run the audit again and open
            the new crawl to see whether a fix held.
          </InfoStrip>
        </div>
      ) : null}
    </div>
  );
}
