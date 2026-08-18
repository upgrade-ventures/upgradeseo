import { waitUntil } from "cloudflare:workers";
import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import { z } from "zod";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import { normalizeDomainInput } from "@/server/lib/domainUtils";
import { getKeywordsPage } from "@/server/features/domain/services/domainKeywordsPage";
import { getPagesPage } from "@/server/features/domain/services/domainPagesPage";
import {
  applyFreeKeywordQuery,
  freeDomainOverviewSchema,
  tryFreeDomainKeywords,
  tryFreeDomainOverview,
} from "@/server/features/domain/services/freeDomainOverview";

// to the provider call, not the cache key, so cached results are shared
// across callers.
type MeteringOverrides = {};

/** Domain overview data is refreshed every 12 hours. */
const DOMAIN_OVERVIEW_TTL_SECONDS = 12 * 60 * 60;

/** How many keywords the overview's suggestion list shows, on either stack. */
const SUGGESTED_KEYWORDS_LIMIT = 100;

const domainOverviewResultSchema = z.object({
  domain: z.string(),
  organicTraffic: z.number().nullable(),
  organicKeywords: z.number().nullable(),
  backlinks: z.number().nullable(),
  referringDomains: z.number().nullable(),
  hasData: z.boolean(),
  fetchedAt: z.string(),
  /**
   * Present only on the free stack. Carries the numbers a free source CAN
   * produce (OpenPageRank authority, keywords the domain targets) plus the
   * user-facing reason for every field above that is null because no free
   * source publishes it. Optional so a payload cached by the paid path still
   * parses.
   */
  free: freeDomainOverviewSchema.optional(),
});

type DomainOverviewResult = z.infer<typeof domainOverviewResultSchema>;

async function getOverview(
  input: {
    projectId: string;
    domain: string;
    includeSubdomains: boolean;
    locationCode: number;
    languageCode: string;
  },
  billingCustomer: OrganizationContext,
  _metering: MeteringOverrides = {},
): Promise<DomainOverviewResult> {
  const domain = normalizeDomainInput(input.domain, input.includeSubdomains);

  const cacheKey = await buildCacheKey("domain:overview", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    domain,
    includeSubdomains: input.includeSubdomains,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
  });

  const cachedRaw = await getCached(cacheKey);
  const cached = domainOverviewResultSchema.safeParse(cachedRaw);
  if (cached.success && cached.data.hasData) {
    return cached.data;
  }

  const nowIso = new Date().toISOString();

  const free = await tryFreeDomainOverview({
    domain,
    locationCode: input.locationCode,
    organizationId: billingCustomer.organizationId,
  });
  {
    return persistOverview(cacheKey, {
      domain,
      // All four are modelled from a licensed rank index on the paid stack.
      // They stay null rather than 0, and `free.unavailable` carries the
      // reason the UI shows in their place.
      organicTraffic: null,
      organicKeywords: null,
      backlinks: null,
      referringDomains: null,
      hasData:
        free.openPageRankAuthority !== null ||
        free.googleAdsTargetedKeywords !== null,
      fetchedAt: nowIso,
      free,
    });
  }
}

function persistOverview(
  cacheKey: string,
  result: DomainOverviewResult,
): DomainOverviewResult {
  if (result.hasData) {
    // waitUntil, not void: workerd cancels unregistered pending I/O once the
    // response is sent, so a fire-and-forget put never persists the cache.
    waitUntil(
      setCached(cacheKey, result, DOMAIN_OVERVIEW_TTL_SECONDS).catch(
        (error) => {
          console.error("domain.overview.cache-write failed:", error);
        },
      ),
    );
  }

  return result;
}

async function getSuggestedKeywords(
  input: {
    domain: string;
    locationCode: number;
    languageCode: string;
    organizationId: string;
    projectId: string;
  },
  billingCustomer: OrganizationContext,
  _metering: MeteringOverrides = {},
): Promise<
  Array<{
    keyword: string;
    position: number | null;
    searchVolume: number | null;
    traffic: number | null;
    cpc: number | null;
    keywordDifficulty: number | null;
  }>
> {
  const domain = normalizeDomainInput(input.domain, true);

  const cacheKey = await buildCacheKey("domain:keyword-suggestions", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    domain,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
  });

  const cachedRaw = await getCached(cacheKey);
  const cached = z
    .array(
      z.object({
        keyword: z.string(),
        position: z.number().nullable(),
        searchVolume: z.number().nullable(),
        traffic: z.number().nullable(),
        cpc: z.number().nullable(),
        keywordDifficulty: z.number().nullable(),
      }),
    )
    .safeParse(cachedRaw);
  if (cached.success && cached.data.length > 0) {
    return cached.data;
  }

  const free = await tryFreeDomainKeywords({
    domain,
    locationCode: input.locationCode,
    organizationId: input.organizationId,
  });
  {
    // This entry point returns a bare array, so there is nowhere to hang the
    // "why is this null" copy. The overview result carries it for the same
    // screen, and the MCP tool prints "?" for a null rather than a zero.
    const suggestions = applyFreeKeywordQuery(free.rows, {
      filters: {},
      sortMode: "volume",
      sortOrder: "desc",
    }).rows.slice(0, SUGGESTED_KEYWORDS_LIMIT);

    const keywords = suggestions.map((row) => ({
      keyword: row.keyword,
      position: row.position,
      searchVolume: row.searchVolume,
      traffic: row.traffic,
      cpc: row.cpc,
      keywordDifficulty: row.keywordDifficulty,
    }));

    if (keywords.length > 0) {
      waitUntil(
        setCached(cacheKey, keywords, DOMAIN_OVERVIEW_TTL_SECONDS).catch(
          (error) => {
            console.error(
              "domain.keyword-suggestions.cache-write failed:",
              error,
            );
          },
        ),
      );
    }

    return keywords;
  }
}

export const DomainService = {
  getOverview,
  getSuggestedKeywords,
  getKeywordsPage,
  getPagesPage,
} as const;
