import type { OrganizationContext } from "@/server/auth/organizationContext";
import { RankTrackingRepository } from "@/server/features/rank-tracking/repositories/RankTrackingRepository";
import { AppError } from "@/server/lib/errors";
import type {
  RankTrackingConfig,
  RankCheckTriggerResult,
} from "@/types/schemas/rank-tracking";
import { reconcileActiveRankCheckRun } from "./rankCheckRunGuards";
import {
  computeNextCheckAt,
  isScheduledRankTrackingInterval,
  MAX_CONFIGS_PER_PROJECT,
} from "@/shared/rank-tracking";
import { resolveMarket } from "@/shared/keyword-locations";
import { getLatestResults } from "./rankTrackingResults";
import { toSqliteTimestamp } from "@/server/features/rank-tracking/rankTrackingTimestamps";
import { RankTrackingKeywordService } from "./RankTrackingKeywordService";
import { runFreeRankCheck } from "./freeRankSource";
import {
  fetchFreeTrackedKeywordMetrics,
  recordFreeRankCheck,
} from "./recordFreeRankCheck";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

async function createConfig(input: {
  projectId: string;
  projectMarket: { locationCode: number; languageCode: string };
  domain: string;
  locationCode?: number;
  languageCode?: string;
  locationName?: string;
  devices?: RankTrackingConfig["devices"];
  serpDepth: number;
  scheduleInterval?: RankTrackingConfig["scheduleInterval"];
}) {
  const normalizedDomain = normalizeDomain(input.domain);

  const { locationCode, languageCode } = resolveMarket(
    input,
    input.projectMarket,
  );
  const scheduleInterval = input.scheduleInterval ?? "weekly";
  const nextCheckAt = isScheduledRankTrackingInterval(scheduleInterval)
    ? computeNextCheckAt(scheduleInterval)
    : null;

  const locationName = input.locationName ?? null;
  const existing =
    await RankTrackingRepository.getConfigByProjectDomainLocation(
      input.projectId,
      normalizedDomain,
      locationCode,
      locationName,
    );
  // The (project, domain, location) row still exists when a domain is
  // archived — archiving only flips isActive to false. So re-adding an
  // archived domain reactivates that row (keeping its keyword/ranking
  // history) with the freshly chosen settings, rather than colliding with
  // the unique index. An already-active row is a genuine duplicate.
  if (existing?.isActive) {
    throw new AppError(
      "VALIDATION_ERROR",
      locationName
        ? "This domain + city combination is already being tracked"
        : "This domain + country combination is already being tracked",
    );
  }

  // Enforced for reactivations too, not just new rows — otherwise archiving
  // and re-adding domains would push a project past the active-config cap.
  const allConfigs = await RankTrackingRepository.getConfigsForProject(
    input.projectId,
  );
  if (allConfigs.length >= MAX_CONFIGS_PER_PROJECT) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Maximum ${MAX_CONFIGS_PER_PROJECT} tracked domains per project`,
    );
  }

  if (existing) {
    await RankTrackingRepository.updateConfig(existing.id, input.projectId, {
      isActive: true,
      languageCode,
      devices: input.devices ?? "both",
      serpDepth: input.serpDepth,
      scheduleInterval,
      nextCheckAt,
      // Drop any stale skip reason from before it was archived so the
      // re-added domain doesn't surface an outdated warning.
      lastSkipReason: null,
    });

    return getValidatedConfig(existing.id, input.projectId);
  }

  const configId = crypto.randomUUID();
  const config: RankTrackingConfig = {
    id: configId,
    projectId: input.projectId,
    domain: normalizedDomain,
    locationCode,
    languageCode,
    locationName,
    devices: input.devices ?? "both",
    serpDepth: input.serpDepth,
    scheduleInterval,
    nextCheckAt,
    isActive: true,
    lastCheckedAt: null,
    lastSkipReason: null,
    createdAt: toSqliteTimestamp(new Date()),
  };

  await RankTrackingRepository.createConfig(config);

  return config;
}

async function updateConfig(
  configId: string,
  projectId: string,
  input: {
    domain?: string;
    locationCode?: number;
    languageCode?: string;
    locationName?: string | null;
    devices?: RankTrackingConfig["devices"];
    serpDepth?: number;
    scheduleInterval?: RankTrackingConfig["scheduleInterval"];
    isActive?: boolean;
  },
) {
  const updates: typeof input & { nextCheckAt?: string | null } = {};

  if (input.domain !== undefined)
    updates.domain = normalizeDomain(input.domain);
  if (input.locationCode !== undefined)
    updates.locationCode = input.locationCode;
  if (input.languageCode !== undefined)
    updates.languageCode = input.languageCode;
  if (input.locationName !== undefined)
    updates.locationName = input.locationName;
  if (input.devices !== undefined) updates.devices = input.devices;
  if (input.serpDepth !== undefined) updates.serpDepth = input.serpDepth;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  if (input.scheduleInterval !== undefined) {
    updates.scheduleInterval = input.scheduleInterval;
    if (input.scheduleInterval === "manual") {
      updates.nextCheckAt = null;
    } else {
      updates.nextCheckAt = computeNextCheckAt(input.scheduleInterval);
    }
  }

  await RankTrackingRepository.updateConfig(configId, projectId, updates);
}

// ---------------------------------------------------------------------------
// Trigger a manual check
// ---------------------------------------------------------------------------

async function triggerCheck(input: {
  configId: string;
  projectId: string;
  billingCustomer: OrganizationContext;
  keywordIds?: string[];
  /**
   * Accepted and ignored. The free rank sources are unmetered, so any
   * approved ceiling is met. The MCP tool still collects one, and enforcing a
   * ceiling would mean inventing a price for a check that costs nothing.
   */
}): Promise<RankCheckTriggerResult> {
  const config = await getValidatedConfig(input.configId, input.projectId);

  const keywords = await RankTrackingRepository.getKeywordsForConfig(config.id);
  if (keywords.length === 0) {
    throw new AppError(
      "INTERNAL_ERROR",
      "No keywords to track. Add keywords to this domain first.",
    );
  }

  // Free sources answer for the whole keyword set in one or two API calls, so a
  // manual check runs inline instead of through the workflow: nothing to meter
  // per keyword and nothing to poll.
  const selectedIds = input.keywordIds ? new Set(input.keywordIds) : null;
  const selectedKeywords = selectedIds
    ? keywords.filter((kw) => selectedIds.has(kw.id))
    : keywords;
  const freeResult = await runFreeRankCheck({
    projectId: input.projectId,
    organizationId: input.billingCustomer.organizationId,
    domain: config.domain,
    locationCode: config.locationCode,
    devices: config.devices,
    keywords: selectedKeywords.map((kw) => ({
      id: kw.id,
      keyword: kw.keyword,
    })),
  });
  if (!freeResult) {
    // null is the free helper's leftover "let the paid client answer" signal,
    // and there is no paid client any more. Name what to connect rather than
    // recording a run with nothing in it.
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      "No rank source is connected. Connect a Google Search Console property covering this domain for Google positions, or add a free Bing Webmaster key for Bing positions.",
    );
  }

  return recordFreeRankCheck({
    configId: config.id,
    projectId: input.projectId,
    keywordsTotal: selectedKeywords.length,
    isSubsetRun: (input.keywordIds?.length ?? 0) > 0,
    result: freeResult,
  });
}

async function getLatestRun(configId: string, projectId: string) {
  await getValidatedConfig(configId, projectId);
  const run = await RankTrackingRepository.getLatestRunForConfig(configId);
  if (!run) return null;

  // If the DB says the run is still active, check the workflow instance.
  // We only report staleness here — the next call to beginRankCheckRun will
  // mark a stale blocker as failed before retrying its insert. Mutating from
  // this read path caused a race where the original workflow kept running
  // while a replacement was started.
  const reconciliation = await reconcileActiveRankCheckRun(run);
  if (reconciliation) {
    return formatRun(run, {
      maybeStale: true,
      staleReason: reconciliation.errorMessage,
    });
  }

  return formatRun(run);
}

// ---------------------------------------------------------------------------
// Keyword metrics (volume, difficulty, CPC)
// ---------------------------------------------------------------------------

async function refreshKeywordMetrics(
  configId: string,
  projectId: string,
  billingCustomer: OrganizationContext,
): Promise<{ updated: number }> {
  const config = await getValidatedConfig(configId, projectId);
  const keywords = await RankTrackingRepository.getKeywordsForConfig(configId);
  if (keywords.length === 0) return { updated: 0 };

  const metrics = await fetchFreeTrackedKeywordMetrics({
    keywords: keywords.map((kw) => kw.keyword),
    locationCode: config.locationCode,
    organizationId: billingCustomer.organizationId,
  });
  if (!metrics) {
    // Same leftover null as in triggerCheck: it used to defer to the paid
    // client. Reporting "0 updated" would read as "these keywords have no
    // volume", which is a different claim.
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      "No keyword data source is connected. Add Microsoft Advertising for volume and CPC with no approval wait, Google Ads for Google's own numbers, or a Bing Webmaster key. All three are free.",
    );
  }
  const byKeyword = new Map(
    metrics.map((metric) => [metric.keyword.toLowerCase(), metric]),
  );

  const now = new Date().toISOString();
  const updates = keywords
    .map((kw) => {
      const metric = byKeyword.get(kw.keyword.toLowerCase());
      if (!metric) return null;
      // Rank tracking only tracks volume / difficulty / CPC.
      return {
        id: kw.id,
        searchVolume: metric.searchVolume,
        keywordDifficulty: metric.keywordDifficulty,
        cpc: metric.cpc,
        metricsFetchedAt: now,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  if (updates.length === 0) return { updated: 0 };
  await RankTrackingRepository.updateKeywordMetrics(updates);
  return { updated: updates.length };
}

// ---------------------------------------------------------------------------
// MCP/browser read models and access policy
// ---------------------------------------------------------------------------

async function getConfigs(projectId: string) {
  return RankTrackingRepository.getConfigsForProject(projectId);
}

async function getTracker(configId: string, projectId: string) {
  const config = await getValidatedConfig(configId, projectId);
  const results = await getLatestResults(configId, projectId);
  return { config, results };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getValidatedConfig(configId: string, projectId: string) {
  const config = await RankTrackingRepository.getConfigById({
    configId,
    projectId,
  });
  if (!config) {
    throw new AppError("NOT_FOUND", "Rank tracking config not found");
  }
  return config;
}

function normalizeDomain(domain: string): string {
  let d = domain.trim().toLowerCase();
  // Strip protocol
  d = d.replace(/^https?:\/\//, "");
  // Strip path, query string, and fragment
  d = d.replace(/[/?#].*$/, "");
  // Strip trailing slash
  d = d.replace(/\/+$/, "");
  // Strip www. prefix
  d = d.replace(/^www\./, "");
  if (!d) {
    throw new AppError("INTERNAL_ERROR", "Invalid domain");
  }
  return d;
}

type RunRow = NonNullable<
  Awaited<ReturnType<typeof RankTrackingRepository.getLatestRunForConfig>>
>;

function formatRun(
  run: RunRow,
  stale?: { maybeStale: boolean; staleReason: string },
) {
  return {
    id: run.id,
    status: run.status,
    keywordsTotal: run.keywordsTotal,
    keywordsChecked: run.keywordsChecked,
    isSubsetRun: run.isSubsetRun,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    maybeStale: stale?.maybeStale ?? false,
    staleReason: stale?.staleReason ?? null,
  };
}

export const RankTrackingService = {
  createConfig,
  updateConfig,
  addKeywords: RankTrackingKeywordService.addKeywords,
  removeKeywords: RankTrackingKeywordService.removeKeywords,
  triggerCheck,
  getLatestRun,
  refreshKeywordMetrics,
  getConfigs,
  getTracker,
};
