import { useMemo } from "react";
import {
  FilterChip,
  ChipCount,
  PanelFootnote,
  PanelMessage,
  Skeleton,
} from "@/client/features/audit/AuditParts";
import {
  FILTER_BAR,
  FILTER_HINT,
  severityColor,
  SEVERITY_EYEBROW,
  SUMMARY_STRIP,
} from "@/client/features/audit/auditStyles";
import {
  countPagesWithIssues,
  groupIssues,
  type AuditIssueRow,
  type IssueGroup,
} from "@/client/features/audit/results/issueGrouping";
import {
  ComparisonChip,
  IssueRow,
  SummaryCell,
} from "@/client/features/audit/results/IssuesPanelParts";
import type { useCrawlComparison } from "@/client/features/audit/results/useCrawlComparison";
import type { IssueSeverity } from "@/shared/audit-issues";

export type IssueFilter = "all" | "critical" | "new" | "fixed";

const SECTION_LABEL: Record<IssueSeverity, string> = {
  critical: "Critical · fix these first",
  warning: "Warnings",
  info: "Notices",
};

export function IssuesPanel({
  issues,
  pagesCrawled,
  filter,
  onFilterChange,
  comparison,
  previousCrawlLabel,
  onOpenIssue,
}: {
  issues: AuditIssueRow[];
  pagesCrawled: number;
  filter: IssueFilter;
  onFilterChange: (filter: IssueFilter) => void;
  comparison: ReturnType<typeof useCrawlComparison>;
  previousCrawlLabel: string | null;
  onOpenIssue: (group: IssueGroup) => void;
}) {
  const groups = useMemo(() => groupIssues(issues), [issues]);
  const severityCounts = useMemo(() => {
    const counts: Record<IssueSeverity, number> = {
      critical: 0,
      warning: 0,
      info: 0,
    };
    for (const group of groups) counts[group.severity] += 1;
    return counts;
  }, [groups]);
  const pagesAffected = useMemo(() => countPagesWithIssues(issues), [issues]);

  const previousGroups = comparison.previousGroups;
  const diff = useMemo(() => {
    if (!previousGroups) return null;
    const previousTypes = new Set(previousGroups.map((g) => g.issueType));
    const currentTypes = new Set(groups.map((g) => g.issueType));
    return {
      newTypes: new Set(
        groups
          .filter((g) => !previousTypes.has(g.issueType))
          .map((g) => g.issueType),
      ),
      fixedGroups: previousGroups.filter((g) => !currentTypes.has(g.issueType)),
    };
  }, [groups, previousGroups]);

  return (
    <>
      <div style={SUMMARY_STRIP}>
        <SummaryCell
          label="Critical"
          value={severityCounts.critical}
          color="var(--danger)"
          caption="issue types"
        />
        <SummaryCell
          label="Warnings"
          value={severityCounts.warning}
          color="var(--warning)"
          caption="issue types"
        />
        <SummaryCell
          label="Notices"
          value={severityCounts.info}
          color="var(--text-2)"
          caption="issue types"
        />
        <SummaryCell
          label="Pages affected"
          value={pagesAffected}
          caption={`of ${pagesCrawled.toLocaleString()}`}
          last
        />
      </div>

      <div style={FILTER_BAR}>
        <FilterChip
          active={filter === "all"}
          onClick={() => onFilterChange("all")}
        >
          All
          <ChipCount>{groups.length}</ChipCount>
        </FilterChip>
        <FilterChip
          active={filter === "critical"}
          onClick={() => onFilterChange("critical")}
        >
          Critical
          <ChipCount>{severityCounts.critical}</ChipCount>
        </FilterChip>
        <ComparisonChip
          active={filter === "new"}
          label="New since last crawl"
          count={diff ? diff.newTypes.size : null}
          comparison={comparison}
          previousCrawlLabel={previousCrawlLabel}
          onClick={() => onFilterChange("new")}
        />
        <ComparisonChip
          active={filter === "fixed"}
          label="Fixed"
          count={diff ? diff.fixedGroups.length : null}
          comparison={comparison}
          previousCrawlLabel={previousCrawlLabel}
          onClick={() => onFilterChange("fixed")}
        />
        <span style={FILTER_HINT}>
          Grouped by severity, then by pages affected
        </span>
      </div>

      <IssueList
        groups={groups}
        filter={filter}
        diff={diff}
        comparison={comparison}
        previousCrawlLabel={previousCrawlLabel}
        hasIssues={issues.length > 0}
        onOpenIssue={onOpenIssue}
      />
    </>
  );
}

function IssueList({
  groups,
  filter,
  diff,
  comparison,
  previousCrawlLabel,
  hasIssues,
  onOpenIssue,
}: {
  groups: IssueGroup[];
  filter: IssueFilter;
  diff: { newTypes: Set<string>; fixedGroups: IssueGroup[] } | null;
  comparison: ReturnType<typeof useCrawlComparison>;
  previousCrawlLabel: string | null;
  hasIssues: boolean;
  onOpenIssue: (group: IssueGroup) => void;
}) {
  if (!hasIssues && filter !== "fixed") {
    return (
      <PanelMessage title="No issues recorded for this crawl.">
        Either the site is in good shape, or this crawl ran before the issue
        checks existed. Run a new crawl for the full report.
      </PanelMessage>
    );
  }

  if (filter === "new" || filter === "fixed") {
    if (!comparison.isAvailable) {
      return (
        <PanelMessage title="Nothing to compare against yet.">
          This is the first completed crawl of this site, so there is no earlier
          run to diff it with.
        </PanelMessage>
      );
    }
    if (comparison.isError) {
      return (
        <PanelMessage
          tone="danger"
          title="The previous crawl could not be loaded."
        >
          It may have been deleted. Pick another view, or run a new crawl.
        </PanelMessage>
      );
    }
    if (!diff) {
      return <ComparisonSkeleton />;
    }
  }

  if (filter === "fixed") {
    const fixed = diff?.fixedGroups ?? [];
    if (fixed.length === 0) {
      return (
        <PanelMessage title="No issue types were cleared since the previous crawl.">
          Everything reported{" "}
          {previousCrawlLabel ? `in ${previousCrawlLabel}` : "last time"} is
          still reported now.
        </PanelMessage>
      );
    }
    return (
      <>
        <div style={{ ...SEVERITY_EYEBROW, color: "var(--text-3)" }}>
          Fixed since {previousCrawlLabel ?? "the previous crawl"}
        </div>
        {fixed.map((group, index) => (
          <IssueRow
            key={group.issueType}
            group={group}
            fixed
            last={index === fixed.length - 1}
            onOpen={onOpenIssue}
          />
        ))}
        <div style={{ padding: "0 var(--pad, 24px)" }}>
          <PanelFootnote>
            Page counts are what the previous crawl found. These issue types are
            not reported in the current crawl.
          </PanelFootnote>
        </div>
      </>
    );
  }

  const visible =
    filter === "critical"
      ? groups.filter((group) => group.severity === "critical")
      : filter === "new"
        ? groups.filter((group) => diff?.newTypes.has(group.issueType))
        : groups;

  if (visible.length === 0) {
    return (
      <PanelMessage
        title={
          filter === "critical"
            ? "No critical issue types in this crawl."
            : `No new issue types since ${previousCrawlLabel ?? "the previous crawl"}.`
        }
      >
        {filter === "critical"
          ? "Warnings and notices are still listed under the All view."
          : "Everything reported here was already reported last time."}
      </PanelMessage>
    );
  }

  const sections = (["critical", "warning", "info"] as const)
    .map((severity) => ({
      severity,
      groups: visible.filter((group) => group.severity === severity),
    }))
    .filter((section) => section.groups.length > 0);

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <div key={section.severity}>
          <div
            style={{
              ...SEVERITY_EYEBROW,
              color: severityColor(section.severity),
            }}
          >
            {SECTION_LABEL[section.severity]}
          </div>
          {section.groups.map((group, index) => (
            <IssueRow
              key={group.issueType}
              group={group}
              isNew={diff?.newTypes.has(group.issueType) ?? false}
              last={
                sectionIndex === sections.length - 1 &&
                index === section.groups.length - 1
              }
              onOpen={onOpenIssue}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function ComparisonSkeleton() {
  return (
    <div style={{ padding: "18px var(--pad, 24px)" }}>
      <Skeleton width="42%" height={12} />
      <Skeleton width="64%" height={10} style={{ marginTop: 8 }} />
    </div>
  );
}
