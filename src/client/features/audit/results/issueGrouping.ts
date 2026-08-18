import {
  getIssueDescriptor,
  ISSUE_SEVERITY_ORDER,
  type IssueSeverity,
} from "@/shared/audit-issues";
import type { AuditResultsData } from "@/client/features/audit/results/types";

export type AuditIssueRow = AuditResultsData["issues"][number];

export interface IssueGroup {
  issueType: string;
  severity: IssueSeverity;
  title: string;
  explanation: string;
  howToFix: string;
  issues: AuditIssueRow[];
  /**
   * Distinct pages carrying this issue. Not `issues.length`: an issue type
   * like a broken internal link records one row per bad target, so a single
   * page can appear several times and "12 pages" would overstate the reach.
   */
  pagesAffected: number;
}

export function resolveIssueSeverity(issue: {
  issueType: string;
  severity: string;
}): IssueSeverity {
  const descriptor = getIssueDescriptor(issue.issueType);
  if (descriptor) return descriptor.severity;
  return issue.severity === "critical" || issue.severity === "warning"
    ? issue.severity
    : "info";
}

/**
 * Issue rows collapsed to one entry per issue type, ordered the way the filter
 * bar claims: severity first, then pages affected.
 */
export function groupIssues(issues: AuditIssueRow[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  const seenPages = new Map<string, Set<string>>();

  for (const issue of issues) {
    let group = groups.get(issue.issueType);
    if (!group) {
      const descriptor = getIssueDescriptor(issue.issueType);
      group = {
        issueType: issue.issueType,
        severity: resolveIssueSeverity(issue),
        title: descriptor?.title ?? issue.issueType,
        explanation: descriptor?.explanation ?? "",
        howToFix: descriptor?.howToFix ?? "",
        issues: [],
        pagesAffected: 0,
      };
      groups.set(issue.issueType, group);
      seenPages.set(issue.issueType, new Set());
    }
    group.issues.push(issue);
    seenPages.get(issue.issueType)?.add(issue.pageId ?? issue.pageUrl);
  }

  for (const group of groups.values()) {
    group.pagesAffected = seenPages.get(group.issueType)?.size ?? 0;
  }

  return Array.from(groups.values()).toSorted(
    (a, b) =>
      ISSUE_SEVERITY_ORDER[a.severity] - ISSUE_SEVERITY_ORDER[b.severity] ||
      b.pagesAffected - a.pagesAffected,
  );
}

/** Distinct pages carrying at least one issue, for the summary strip. */
export function countPagesWithIssues(issues: AuditIssueRow[]): number {
  const pages = new Set<string>();
  for (const issue of issues) pages.add(issue.pageId ?? issue.pageUrl);
  return pages.size;
}
