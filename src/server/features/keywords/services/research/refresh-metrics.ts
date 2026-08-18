import { KeywordResearchRepository } from "@/server/features/keywords/repositories/KeywordResearchRepository";
import { resolveFreeSeoEnv } from "@/server/lib/free-seo/resolveFreeSeoEnv";
import { normalizeIntent } from "@/server/features/keywords/services/research/helpers";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import type { RefreshSavedKeywordMetricsInput } from "@/types/schemas/keywords";
import type { KeywordMetricRow } from "@/server/lib/seo/keyword-metrics";
import { createFreeSeoProvider } from "@/server/lib/free-seo/provider";
import { AppError } from "@/server/lib/errors";

/**
 * Metrics for one homogeneous group of keywords, from the free providers.
 * Mirrors `freeResearchRows` in research-data.ts. This path previously had no
 * free branch at all, so "Refresh metrics" was dead on a free install and
 * failed with a raw missing-env error rather than guidance.
 */
async function freeKeywordMetrics(input: {
  keywords: string[];
  locationCode: number;
  organizationId: string;
}): Promise<KeywordMetricRow[]> {
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
  const rows: KeywordMetricRow[] = [];
  for (const keyword of input.keywords) {
    const metric = await free.keywordVolume({
      keyword,
      locationCode: input.locationCode,
    });
    if (!metric) continue;
    rows.push({
      keyword: metric.keyword,
      searchVolume: metric.searchVolume,
      cpc: metric.cpc,
      competition: metric.competition,
      competitionLevel: null,
      keywordDifficulty: metric.keywordDifficulty,
      intent: metric.intent,
      monthlySearches: metric.trend,
    });
  }
  return rows;
}

// Cap concurrent D1 upserts per group. A project can accumulate thousands of
// saved keywords in one location/language, and fanning out one promise each
// would flood D1/Worker resources; write in bounded chunks instead.
const REFRESH_UPSERT_BATCH_SIZE = 100;

export async function refreshSavedKeywordMetrics(
  input: RefreshSavedKeywordMetricsInput,
  billingCustomer: OrganizationContext,
): Promise<{ updated: number }> {
  const { rows } = await KeywordResearchRepository.listSavedKeywordsByProject({
    projectId: input.projectId,
  });

  if (rows.length === 0) return { updated: 0 };

  let updated = 0;

  // Group by (locationCode, languageCode) so each provider call is homogeneous.
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.row.locationCode}:${row.row.languageCode}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  for (const groupRows of groups.values()) {
    const { locationCode, languageCode } = groupRows[0].row;
    const keywords = groupRows.map((r) => r.row.keyword);
    const metrics = await freeKeywordMetrics({
      keywords,
      locationCode,
      organizationId: billingCustomer.organizationId,
    });
    const byKeyword = new Map(
      metrics.map((metric) => [metric.keyword.toLowerCase(), metric]),
    );

    for (let i = 0; i < groupRows.length; i += REFRESH_UPSERT_BATCH_SIZE) {
      const chunk = groupRows.slice(i, i + REFRESH_UPSERT_BATCH_SIZE);
      await Promise.all(
        chunk.map((r) => {
          const metric = byKeyword.get(r.row.keyword.toLowerCase());
          if (!metric) return Promise.resolve();
          return KeywordResearchRepository.upsertKeywordMetric({
            projectId: input.projectId,
            keyword: r.row.keyword,
            locationCode,
            languageCode,
            searchVolume: metric.searchVolume,
            cpc: metric.cpc,
            competition: metric.competition,
            keywordDifficulty: metric.keywordDifficulty,
            intent: normalizeIntent(metric.intent),
            monthlySearchesJson: JSON.stringify(metric.monthlySearches),
          });
        }),
      );
    }

    updated += byKeyword.size;
  }

  return { updated };
}
