import { waitUntil } from "cloudflare:workers";
import { z } from "zod";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import { normalizeDomainInput } from "@/server/lib/domainUtils";
import { computeHasMore } from "@/server/features/domain/services/pagination";
import {
  buildKeywordFilters,
  buildOrderBy,
  type DomainKeywordsSortMode,
  type DomainKeywordsSortOrder,
} from "@/server/features/domain/services/domainKeywordFilters";
import {
  applyFreeKeywordQuery,
  freeDomainNoteSchema,
  FREE_SOURCE_LABEL,
  tryFreeDomainKeywords,
} from "@/server/features/domain/services/freeDomainOverview";
import type { DomainKeywordsFilters } from "@/types/schemas/domain";

const DOMAIN_KEYWORDS_PAGE_TTL_SECONDS = 12 * 60 * 60;

const domainKeywordsPageResultSchema = z.object({
  domain: z.string(),
  page: z.number(),
  pageSize: z.number(),
  totalCount: z.number().nullable(),
  hasMore: z.boolean(),
  keywords: z.array(
    z.object({
      keyword: z.string(),
      position: z.number().nullable(),
      searchVolume: z.number().nullable(),
      traffic: z.number().nullable(),
      cpc: z.number().nullable(),
      url: z.string().nullable(),
      relativeUrl: z.string().nullable(),
      keywordDifficulty: z.number().nullable(),
    }),
  ),
  fetchedAt: z.string(),
  /**
   * Present only on the free stack: why position, traffic, difficulty and the
   * ranking URL are null on every row here. Optional so a payload cached by
   * the paid path still parses.
   */
  free: freeDomainNoteSchema.optional(),
});

type DomainKeywordsPageResult = z.infer<typeof domainKeywordsPageResultSchema>;

export async function getKeywordsPage(
  input: {
    projectId: string;
    domain: string;
    includeSubdomains: boolean;
    locationCode: number;
    languageCode: string;
    page: number;
    pageSize: number;
    sortMode: DomainKeywordsSortMode;
    sortOrder: DomainKeywordsSortOrder;
    filters: DomainKeywordsFilters;
    search?: string;
  },
  billingCustomer: OrganizationContext,
): Promise<DomainKeywordsPageResult> {
  const domain = normalizeDomainInput(input.domain, input.includeSubdomains);
  const offset = (input.page - 1) * input.pageSize;
  const _orderBy = buildOrderBy(input.sortMode, input.sortOrder);
  const _filters = buildKeywordFilters(input.filters, input.search);

  const cacheKey = await buildCacheKey("domain:keywords-page", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    domain,
    includeSubdomains: input.includeSubdomains,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    page: input.page,
    pageSize: input.pageSize,
    sortMode: input.sortMode,
    sortOrder: input.sortOrder,
    filters: input.filters,
    search: input.search,
  });

  const cachedRaw = await getCached(cacheKey);
  const cached = domainKeywordsPageResultSchema.safeParse(cachedRaw);
  if (cached.success) {
    return cached.data;
  }

  const free = await tryFreeDomainKeywords({
    domain,
    locationCode: input.locationCode,
    organizationId: billingCustomer.organizationId,
  });
  {
    // One Google Ads call returns the whole idea set, so filtering, sorting
    // and paging happen here instead of being pushed down to a remote query.
    const query = applyFreeKeywordQuery(free.rows, {
      filters: input.filters,
      search: input.search,
      sortMode: input.sortMode,
      sortOrder: input.sortOrder,
    });
    const pageRows = query.rows.slice(offset, offset + input.pageSize);

    const freeResult: DomainKeywordsPageResult = {
      domain,
      page: input.page,
      pageSize: input.pageSize,
      // An exact count of the rows we hold, not an estimate of the domain's
      // ranked keywords. `free.truncated` says whether Google capped the set.
      totalCount: query.rows.length,
      hasMore: computeHasMore(
        offset,
        pageRows.length,
        query.rows.length,
        input.pageSize,
      ),
      keywords: pageRows,
      fetchedAt: new Date().toISOString(),
      free: {
        unavailable: query.unavailable,
        source: FREE_SOURCE_LABEL.keywords,
        truncated: free.truncated,
      },
    };

    waitUntil(
      setCached(cacheKey, freeResult, DOMAIN_KEYWORDS_PAGE_TTL_SECONDS).catch(
        (error) => {
          console.error("domain.keywords-page.cache-write failed:", error);
        },
      ),
    );

    return freeResult;
  }
}
