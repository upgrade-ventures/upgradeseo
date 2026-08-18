import type { OrganizationContext } from "@/server/auth/organizationContext";
import { ActivationRepository } from "@/server/features/activation/repositories/ActivationRepository";
import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { getIssueTypePageCountsForAudit } from "@/server/features/audit/repositories/auditSummaryQueries";
import { BacklinkSnapshotRepository } from "@/server/features/dashboard/repositories/BacklinkSnapshotRepository";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { GscConnectionRepository } from "@/server/features/gsc/repositories/GscConnectionRepository";
import { RankTrackingRepository } from "@/server/features/rank-tracking/repositories/RankTrackingRepository";
import { getLatestResults } from "@/server/features/rank-tracking/services/rankTrackingResults";
import { BacklinksService } from "@/server/features/backlinks/services/BacklinksService";
import {
  getActivity,
  getSearchSummary,
} from "@/server/features/dashboard/services/dashboardFeeds";

// Daily cadence: fresh numbers each visit without per-visit spend; a dormant
// project costs nothing because refreshes are visit-triggered.
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Bounds the per-config result reads on the overview path; projects rarely
// have more than a couple of configs.
const MAX_CONFIGS_FOR_OVERVIEW = 5;

export type DashboardActivation = {
  domain: string | null;
  ga4: {
    connected: boolean;
    propertyDisplayName: string | null;
    cardDismissedAt: string | null;
  };
  gsc: { connected: boolean; siteUrl: string | null };
  mcp: {
    authorizedAt: string | null;
    firstToolCallAt: string | null;
    cardDismissedAt: string | null;
  };
  competitorClickedAt: string | null;
};

type DashboardRankSummary = {
  trackedKeywords: number;
  improved: number;
  declined: number;
  top10: number;
  lastCheckedAt: string | null;
};

export type DashboardAuditSummary = {
  status: "running" | "completed" | "failed";
  pagesCrawled: number;
  startedAt: string;
  // Top issue types by severity then affected-page count, for the card's list.
  topIssues: {
    issueType: string;
    severity: "critical" | "warning" | "info";
    count: number;
  }[];
  totalIssueTypes: number;
};

type DashboardBacklinkSummary = {
  domain: string;
  /**
   * Authority PROXY on 0-100 (OpenPageRank, or the keyless Ahrefs Domain
   * Rating), not a licensed link-index rank. Any copy that shows it must say
   * so.
   */
  rank: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  newBacklinks: number | null;
  lostBacklinks: number | null;
  newReferringDomains: number | null;
  lostReferringDomains: number | null;
  capturedAt: string;
  stale: boolean;
};

/**
 * 28-day Search Console totals, plus the preceding 28 days so each figure can
 * carry a change.
 *
 * Null when Search Console is not connected, or when Google returned nothing —
 * the caller renders "no data" rather than a zero, because a zero here would
 * read as "your site got no clicks" when the truth is "we never asked".
 */
export type DashboardSearchSummary = {
  clicks: number;
  impressions: number;
  /** Fraction, 0-1, as Google reports it. */
  ctr: number;
  /** 1-based average position. */
  position: number;
  /** Same four figures for the previous 28 days, or null on a new property. */
  previous: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null;
};

/**
 * One entry in the dashboard's activity timeline.
 *
 * Assembled from records the app already writes — audit runs, rank-check runs
 * and connection events. There is deliberately no separate event-log table: a
 * second write path would be one more thing to keep in sync, and everything the
 * timeline shows already has a durable row with a timestamp on it.
 */
export type DashboardActivityEntry = {
  id: string;
  /** Drives the icon and the dot colour. */
  kind: "audit" | "rank" | "connection";
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  detail: string | null;
  /** ISO 8601. */
  at: string;
};

type DashboardOverview = {
  rank: DashboardRankSummary | null;
  audit: DashboardAuditSummary | null;
  backlinks: DashboardBacklinkSummary | null;
  search: DashboardSearchSummary | null;
};

async function getActivation(input: {
  projectId: string;
  organizationId: string;
  domain: string | null;
}): Promise<DashboardActivation> {
  const [ga4, gsc, orgActivation, projectActivation] = await Promise.all([
    Ga4ConnectionRepository.getByProjectId(input.projectId),
    GscConnectionRepository.getByProjectId(input.projectId),
    ActivationRepository.getOrganizationActivation(input.organizationId),
    ActivationRepository.getProjectActivation(input.projectId),
  ]);

  return {
    domain: input.domain,
    ga4: {
      connected: ga4 !== null,
      propertyDisplayName: ga4?.propertyDisplayName ?? null,
      cardDismissedAt: projectActivation?.ga4CardDismissedAt ?? null,
    },
    gsc: { connected: gsc !== null, siteUrl: gsc?.siteUrl ?? null },
    mcp: {
      authorizedAt: orgActivation?.firstMcpAuthorizedAt ?? null,
      firstToolCallAt: orgActivation?.firstMcpToolCallAt ?? null,
      cardDismissedAt: projectActivation?.mcpCardDismissedAt ?? null,
    },
    competitorClickedAt: projectActivation?.competitorStepClickedAt ?? null,
  };
}

async function getOverview(input: {
  projectId: string;
  domain: string | null;
}): Promise<DashboardOverview> {
  const [rank, audit, backlinks, search] = await Promise.all([
    getRankSummary(input.projectId),
    getAuditSummary(input.projectId),
    getBacklinkSummary(input.projectId, input.domain),
    getSearchSummary(input.projectId),
  ]);
  return { rank, audit, backlinks, search };
}

/**
 * Totals for the last 28 complete days and the 28 before them.
 *
 * Google's data lags roughly three days, so both windows are offset by
 * SEARCH_LAG_DAYS; without that the current window is always short a few days
 * and every metric reads as falling.
 */
async function getRankSummary(
  projectId: string,
): Promise<DashboardRankSummary | null> {
  const configs = await RankTrackingRepository.getConfigsForProject(projectId);
  if (configs.length === 0) return null;

  const results = await Promise.all(
    configs
      .slice(0, MAX_CONFIGS_FOR_OVERVIEW)
      .map((config) => getLatestResults(config.id, projectId, "7d")),
  );

  const summary: DashboardRankSummary = {
    trackedKeywords: 0,
    improved: 0,
    declined: 0,
    top10: 0,
    lastCheckedAt: null,
  };

  for (const result of results) {
    summary.trackedKeywords += result.rows.length;
    if (
      result.run?.lastCheckedAt &&
      (!summary.lastCheckedAt ||
        result.run.lastCheckedAt > summary.lastCheckedAt)
    ) {
      summary.lastCheckedAt = result.run.lastCheckedAt;
    }
    for (const row of result.rows) {
      for (const device of ["desktop", "mobile"] as const) {
        const { position, previousPosition } = row[device];
        if (position !== null && position <= 10) summary.top10 += 1;
        if (position === null || previousPosition === null) continue;
        // Lower position number = better ranking.
        if (position < previousPosition) summary.improved += 1;
        else if (position > previousPosition) summary.declined += 1;
      }
    }
  }

  return summary;
}

async function getAuditSummary(
  projectId: string,
): Promise<DashboardAuditSummary | null> {
  const audit = await AuditRepository.getLatestAuditForProject(projectId);
  if (!audit) return null;

  const typeRows = await getIssueTypePageCountsForAudit(audit.id);

  const severityRank = { critical: 0, warning: 1, info: 2 };
  const sorted = typeRows
    .map((row) => ({
      issueType: row.issueType,
      severity: row.severity,
      count: row.pages,
    }))
    .toSorted(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        b.count - a.count,
    );

  return {
    status: audit.status,
    pagesCrawled: audit.pagesCrawled,
    startedAt: audit.startedAt,
    topIssues: sorted.slice(0, 3),
    totalIssueTypes: sorted.length,
  };
}

function isSnapshotFresh(capturedAt: string): boolean {
  const capturedMs = Date.parse(capturedAt);
  if (Number.isNaN(capturedMs)) return false;
  return Date.now() - capturedMs < SNAPSHOT_MAX_AGE_MS;
}

async function getBacklinkSummary(
  projectId: string,
  domain: string | null,
): Promise<DashboardBacklinkSummary | null> {
  if (!domain) return null;
  const snapshot =
    await BacklinkSnapshotRepository.getLatestForProject(projectId);
  if (!snapshot || snapshot.domain !== domain) return null;
  return {
    domain: snapshot.domain,
    rank: snapshot.rank,
    backlinks: snapshot.backlinks,
    referringDomains: snapshot.referringDomains,
    newBacklinks: snapshot.newBacklinks,
    lostBacklinks: snapshot.lostBacklinks,
    newReferringDomains: snapshot.newReferringDomains,
    lostReferringDomains: snapshot.lostReferringDomains,
    capturedAt: snapshot.capturedAt,
    stale: !isSnapshotFresh(snapshot.capturedAt),
  };
}

/**
 * Visit-triggered snapshot refresh, a no-op while the latest snapshot for the
 * current domain is under a day old.
 *
 * Reads the same free overview the Backlinks page renders rather than its own
 * source, so the card and the page can never quote different numbers, and a
 * warm entry in that shared cache makes the visit free. The free sources fill
 * authority and referring domains only; new/lost movement has no free source
 * and stays null, which the card renders as a dash rather than as zero.
 *
 * When no free source is connected the overview throws
 * DATA_SOURCE_NOT_CONFIGURED. With a stale snapshot in hand that is swallowed
 * so the card keeps showing the older real numbers; with nothing in hand it
 * propagates, because the naming-the-fix message is more use than an empty
 * card.
 */
async function ensureBacklinkSnapshot(input: {
  projectId: string;
  domain: string | null;
  billingCustomer: OrganizationContext;
}): Promise<DashboardBacklinkSummary | null> {
  const { projectId, domain } = input;
  if (!domain) return null;

  const latest =
    await BacklinkSnapshotRepository.getLatestForProject(projectId);
  const latestMatchesDomain = latest !== null && latest.domain === domain;
  if (latest && latestMatchesDomain && isSnapshotFresh(latest.capturedAt)) {
    return getBacklinkSummary(projectId, domain);
  }

  try {
    const { overview } = await BacklinksService.profileOverview(
      { target: domain, scope: "domain" },
      input.billingCustomer,
    );
    const summary = overview.summary;
    await BacklinkSnapshotRepository.insert({
      projectId,
      domain,
      // The column is an integer and the authority proxy is a 0-100 score
      // with one decimal, so it is rounded to fit. Rounding a proxy loses
      // nothing a reader could act on; storing 5.7 in an integer column
      // behaves differently on SQLite and Postgres.
      rank: summary.rank === null ? null : Math.round(summary.rank),
      backlinks: summary.backlinks,
      referringDomains: summary.referringDomains,
      brokenBacklinks: summary.brokenBacklinks,
      newBacklinks: summary.newBacklinks,
      lostBacklinks: summary.lostBacklinks,
      newReferringDomains: summary.newReferringDomains,
      lostReferringDomains: summary.lostReferringDomains,
      capturedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (latestMatchesDomain) {
      console.error("dashboard: backlink snapshot refresh failed", error);
      return getBacklinkSummary(projectId, domain);
    }
    throw error;
  }

  return getBacklinkSummary(projectId, domain);
}

/**
 * The activity timeline, newest first.
 *
 * Reads real rows only. A project with no history returns an empty list, which
 * the UI renders as an empty state rather than as invented history.
 */

export const DashboardService = {
  getActivation,
  getOverview,
  getActivity,
  ensureBacklinkSnapshot,
};
