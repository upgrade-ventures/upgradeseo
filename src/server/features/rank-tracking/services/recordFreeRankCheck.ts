/**
 * Persistence for a finished free rank check. Split from freeRankSource.ts so
 * the sources (which decide WHAT a position is) stay separate from the writer
 * (which decides how a run is recorded).
 */

import type { FreeRankCheckResult } from "@/server/features/rank-tracking/services/freeRankSource";
import type { RankCheckTriggerResult } from "@/types/schemas/rank-tracking";
import { createFreeSeoProvider } from "@/server/lib/free-seo/provider";
import { AppError } from "@/server/lib/errors";
import { resolveFreeSeoEnv } from "@/server/lib/free-seo/resolveFreeSeoEnv";

/**
 * Persist an already-finished free check as a normal run, so the tracker,
 * history and polling UI treat it exactly like a paid one. Free sources answer
 * for the whole keyword set in one or two calls, so there is no workflow to
 * pace and the run is created and completed in one go.
 *
 * The source label rides on `errorMessage`: rank_check_runs has no label
 * column, and that field is already the run's free-text notice channel (the
 * workflow writes "Completed 3 of 5 keyword(s)" there). Nobody may read a
 * Search Console average as a live SERP position, so the sentence has to
 * travel with the run.
 */
export async function recordFreeRankCheck(input: {
  configId: string;
  projectId: string;
  keywordsTotal: number;
  isSubsetRun: boolean;
  result: FreeRankCheckResult;
}): Promise<RankCheckTriggerResult> {
  // Dynamic for the same reason as the imports above: the repository reaches
  // the database, and the pure helpers here are unit-tested without one.
  const { RankTrackingRepository } =
    await import("@/server/features/rank-tracking/repositories/RankTrackingRepository");

  const runId = crypto.randomUUID();
  const created = await RankTrackingRepository.tryCreateRun({
    id: runId,
    configId: input.configId,
    projectId: input.projectId,
    keywordsTotal: input.keywordsTotal,
    isSubsetRun: input.isSubsetRun,
  });
  if (!created) {
    // Blocked by the partial unique index: another run is already active.
    const blocker = await RankTrackingRepository.getActiveRunForConfig(
      input.configId,
    );
    return {
      ok: false,
      reason: "already_running",
      blockingRunId: blocker?.id ?? null,
    };
  }

  // From here the row holds this config's single active-run slot, and in free
  // mode nothing else ever releases it: a stale blocker is cleared by
  // beginRankCheckRun, which a free check never calls. So a failed write has to
  // mark the run failed, or one transient D1 error would leave the config
  // answering "already running" forever.
  try {
    if (input.result.rows.length > 0) {
      await RankTrackingRepository.insertSnapshots(
        // Free sources report no SERP features. Null is "unknown", where an
        // empty array would claim the SERP has none.
        input.result.rows.map((row) => ({ ...row, runId, serpFeatures: null })),
      );
    }

    const nowIso = new Date().toISOString();
    await RankTrackingRepository.updateRun(runId, {
      status: "completed",
      keywordsChecked: input.result.keywordsChecked,
      completedAt: nowIso,
      errorMessage: input.result.notice,
    });
    await RankTrackingRepository.updateConfig(input.configId, input.projectId, {
      lastCheckedAt: nowIso,
      lastSkipReason: null,
    });
  } catch (error) {
    const { failRunIfActive } = await import("./rankCheckRunGuards");
    await failRunIfActive(runId, "Failed to store free rank check results");
    throw error;
  }

  return { ok: true, runId };
}

type FreeTrackedKeywordMetric = {
  keyword: string;
  /**
   * Real Google monthly searches when Google Ads is configured. With only a
   * Bing key it is BING IMPRESSIONS, a proxy that runs an order of magnitude
   * below Google demand and must be labelled as Bing wherever it is shown.
   */
  searchVolume: number | null;
  /** Google Ads top-of-page bid midpoint, or null. Bing supplies no CPC. */
  cpc: number | null;
  keywordDifficulty: number | null;
};

/**
 * Volume and CPC for tracked keywords from the free sources, or null when the
 * paid client should be used. Mirrors `tryFreeKeywordMetrics` in
 * keywords/services/research/refresh-metrics.ts.
 *
 * Google Ads answers first with real Google numbers; Bing is the no-approval
 * fallback and its volume is a Bing proxy, not Google volume (see the type).
 *
 * Difficulty stays null: the free difficulty proxy needs the domains currently
 * ranking for the term, and without a SERP source we do not have them. Null
 * renders as "no data"; a number here would be invented.
 */
export async function fetchFreeTrackedKeywordMetrics(input: {
  keywords: string[];
  locationCode: number;
  organizationId: string;
}): Promise<FreeTrackedKeywordMetric[] | null> {
  const free = createFreeSeoProvider(
    await resolveFreeSeoEnv(input.organizationId),
  );
  if (!free.available) {
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      "No keyword data source is connected. Add Microsoft Advertising for volume and CPC with no approval wait, Google Ads for Google's own numbers, or a Bing Webmaster key. All three are free.",
    );
  }

  // One call per keyword: neither free source has a bulk-metrics endpoint, and
  // a keyword the source does not know is dropped rather than stored as zero.
  const metrics: FreeTrackedKeywordMetric[] = [];
  for (const keyword of input.keywords) {
    const metric = await free.keywordVolume({
      keyword,
      locationCode: input.locationCode,
    });
    if (!metric) continue;
    metrics.push({
      keyword: metric.keyword,
      searchVolume: metric.searchVolume,
      cpc: metric.cpc,
      keywordDifficulty: metric.keywordDifficulty,
    });
  }
  return metrics;
}
