import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { GscConnectionRepository } from "@/server/features/gsc/repositories/GscConnectionRepository";
import { GscService } from "@/server/features/gsc/services/GscService";
import { RankTrackingRepository } from "@/server/features/rank-tracking/repositories/RankTrackingRepository";
import type {
  DashboardActivityEntry,
  DashboardSearchSummary,
} from "@/server/features/dashboard/services/DashboardService";

// Search Console finalises data roughly three days behind, so both comparison
// windows end there rather than today.
const SEARCH_LAG_DAYS = 3;
const SEARCH_WINDOW_DAYS = 28;
// The design's Activity tab shows a year; this bounds the read for a project
// that runs daily checks.
const ACTIVITY_LIMIT = 40;
// Bounds the per-config run reads; projects rarely have more than a couple.
const MAX_CONFIGS_FOR_ACTIVITY = 5;

/** GSC wants plain YYYY-MM-DD. */
function gscDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getSearchSummary(
  projectId: string,
): Promise<DashboardSearchSummary | null> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - SEARCH_LAG_DAYS);
  const currentStart = new Date(end);
  currentStart.setUTCDate(currentStart.getUTCDate() - (SEARCH_WINDOW_DAYS - 1));
  const previousEnd = new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(
    previousStart.getUTCDate() - (SEARCH_WINDOW_DAYS - 1),
  );

  try {
    // No dimensions: Google then returns a single totals row per window.
    const [current, previous] = await Promise.all([
      GscService.getPerformance({
        projectId,
        startDate: gscDay(currentStart),
        endDate: gscDay(end),
        rowLimit: 1,
      }),
      GscService.getPerformance({
        projectId,
        startDate: gscDay(previousStart),
        endDate: gscDay(previousEnd),
        rowLimit: 1,
      }),
    ]);

    const now = current.rows[0];
    if (!now) return null;
    const before = previous.rows[0] ?? null;

    return {
      clicks: now.clicks,
      impressions: now.impressions,
      ctr: now.ctr,
      position: now.position,
      previous: before
        ? {
            clicks: before.clicks,
            impressions: before.impressions,
            ctr: before.ctr,
            position: before.position,
          }
        : null,
    };
  } catch (error) {
    // A missing or revoked connection is the normal case for a project that
    // never connected Search Console, not an error worth failing the whole
    // dashboard over. The tiles render as unavailable.
    console.info("[dashboard] search summary unavailable:", error);
    return null;
  }
}

export async function getActivity(input: {
  projectId: string;
  limit?: number;
}): Promise<DashboardActivityEntry[]> {
  const limit = input.limit ?? ACTIVITY_LIMIT;
  const entries: DashboardActivityEntry[] = [];

  const [audits, configs, gsc, ga4] = await Promise.all([
    AuditRepository.getAuditsByProject(input.projectId),
    RankTrackingRepository.getConfigsForProject(input.projectId),
    GscConnectionRepository.getByProjectId(input.projectId),
    Ga4ConnectionRepository.getByProjectId(input.projectId),
  ]);

  for (const audit of audits.slice(0, limit)) {
    // An audit that is still running has no completedAt yet; date it by when it
    // started so it still sorts into the timeline.
    const at = audit.completedAt ?? audit.startedAt;
    if (!at) continue;
    entries.push({
      id: `audit-${audit.id}`,
      kind: "audit",
      tone:
        audit.status === "failed"
          ? "danger"
          : audit.status === "completed"
            ? "success"
            : "info",
      title:
        audit.status === "failed"
          ? "Site audit failed"
          : audit.status === "completed"
            ? "Site audit finished"
            : "Site audit running",
      detail:
        audit.pagesCrawled > 0
          ? `${audit.pagesCrawled.toLocaleString()} pages crawled`
          : null,
      at: toIso(at),
    });
  }

  const runs = await Promise.all(
    configs.slice(0, MAX_CONFIGS_FOR_ACTIVITY).map((config) =>
      RankTrackingRepository.getLatestRunForConfig(config.id).then((run) => ({
        config,
        run,
      })),
    ),
  );
  for (const { config, run } of runs) {
    if (!run) continue;
    const at = run.completedAt ?? run.startedAt;
    if (!at) continue;
    entries.push({
      id: `rank-${run.id}`,
      kind: "rank",
      tone: run.status === "failed" ? "danger" : "success",
      title:
        run.status === "failed" ? "Rank check failed" : "Rank check finished",
      detail: config.domain,
      at: toIso(at),
    });
  }

  if (gsc?.createdAt) {
    entries.push({
      id: `gsc-${gsc.id}`,
      kind: "connection",
      tone: "success",
      title: "Search Console connected",
      detail: gsc.siteUrl,
      at: toIso(gsc.createdAt),
    });
  }
  if (ga4?.createdAt) {
    entries.push({
      id: `ga4-${ga4.id}`,
      kind: "connection",
      tone: "success",
      title: "Google Analytics connected",
      detail: ga4.propertyDisplayName,
      at: toIso(ga4.createdAt),
    });
  }

  return entries.toSorted((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Columns are Date on Postgres and epoch-backed on D1; normalise to ISO. */
function toIso(value: Date | string | number): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return new Date(value).toISOString();
}
