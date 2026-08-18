import { waitUntil } from "cloudflare:workers";
import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import type { SerpResultItem } from "@/types/keywords";
import { z } from "zod";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import { normalizeKeyword } from "./helpers";
import { AppError } from "@/server/lib/errors";
import { gscCountryFor, marketFor } from "@/server/lib/free-seo/markets";
import type { GscPerformanceFilter } from "@/server/features/gsc/searchAnalytics";

const SERP_CACHE_TTL_SECONDS = 12 * 60 * 60;

/** Window the analysis averages over, and the copy that names it. */
const FREE_SERP_WINDOW_LABEL = "the last 28 days";

type SerpAnalysisResult = {
  requestedKeyword: string;
  items: SerpResultItem[];
  /** Set when the query returned nothing, so the caller can say why. */
  reason?: "own_site_no_impressions";
  /** Which source produced `items`, so nothing reads a row as a live SERP. */
  source?: "gsc_own_site_average_position";
  /** User-facing sentence describing what `items` actually are. */
  notice?: string;
};

const serpResultItemSchema = z.object({
  rank: z.number().int(),
  title: z.string(),
  url: z.string(),
  domain: z.string(),
  description: z.string(),
  etv: z.number().nullable(),
  estimatedPaidTrafficCost: z.number().nullable(),
  referringDomains: z.number().nullable(),
  backlinks: z.number().nullable(),
  isNew: z.boolean(),
  rankChange: z.number().nullable(),
});

const serpCacheSchema = z.object({
  requestedKeyword: z.string(),
  items: z.array(serpResultItemSchema),
  reason: z.enum(["own_site_no_impressions"]).optional(),
  source: z.enum(["gsc_own_site_average_position"]).optional(),
  notice: z.string().optional(),
});

/**
 * SERP analysis, from the only source there is.
 *
 * THE CONSTRAINT: no free licensed source returns the ten organic results for
 * an arbitrary keyword, so the competitor ranking table cannot be reproduced
 * and is not faked here. What IS free and real is Search Console: for a keyword
 * the project's own verified property has impressions on, it reports which of
 * OUR pages Google shows and at what average position. So this answers a
 * narrower question honestly, "where do I rank for this", instead of answering
 * the wide one with invented rows.
 *
 * Every row is labelled in `title` as well as in `source`/`notice`, because
 * the results table renders the title and would otherwise look like a SERP.
 */
async function getOwnSiteSerpAnalysis(input: {
  projectId: string;
  keyword: string;
  locationCode: number;
}): Promise<SerpAnalysisResult> {
  // Imported dynamically because the GSC service reaches the database, and
  // this module's pure mappers are unit-tested without a DB binding.
  const { GscService } =
    await import("@/server/features/gsc/services/GscService");
  const connection = await GscService.getConnection(input.projectId);
  if (!connection) {
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      "Live SERP results for an arbitrary keyword are not available from any free source. Connect Google Search Console to this project to see which of your own pages Google ranks for this keyword and at what average position.",
    );
  }

  const market = marketFor(input.locationCode);
  // Only filter by country when the market is one we map. An inexact match
  // falls back to the US, and filtering on the wrong country returns nothing,
  // which would read as "your site does not rank".
  const filters: GscPerformanceFilter[] = [
    {
      dimension: "query",
      operator: "equals",
      expression: input.keyword,
    },
  ];
  if (market.exact) {
    filters.push({
      dimension: "country",
      operator: "equals",
      expression: gscCountryFor(input.locationCode),
    });
  }

  const performance = await GscService.getPerformance({
    projectId: input.projectId,
    dimensions: ["query", "page"],
    dateRange: "last_28_days",
    rowLimit: 100,
    filters,
  });

  const items: SerpResultItem[] = performance.rows
    .filter((row) => row.keys?.[1])
    .map((row) => {
      const url = row.keys?.[1] ?? "";
      let domain = "";
      try {
        domain = new URL(url).hostname;
      } catch {
        domain = "";
      }
      return {
        // The average position over the window, rounded to sit in a rank
        // column. Position 1 is the floor.
        rank: Math.max(1, Math.round(row.position)),
        // The label leads the string because the table truncates the tail.
        title: `Your page, Search Console average position ${row.position.toFixed(1)} over ${FREE_SERP_WINDOW_LABEL}`,
        url,
        domain,
        description: `Search Console reported ${row.impressions} impression(s) and ${row.clicks} click(s) for this page on this query over ${FREE_SERP_WINDOW_LABEL}. This is an average over that window, not a live SERP check.`,
        // Traffic value and backlink counts need a paid source. Null is
        // "unknown"; a zero would claim the page earns nothing and has no
        // links.
        etv: null,
        estimatedPaidTrafficCost: null,
        referringDomains: null,
        backlinks: null,
        isNew: false,
        rankChange: null,
      };
    })
    .toSorted((a, b) => a.rank - b.rank);

  const result: SerpAnalysisResult = {
    requestedKeyword: input.keyword,
    items,
    source: "gsc_own_site_average_position",
    notice: `These are your own Search Console positions for ${connection.siteUrl} over ${FREE_SERP_WINDOW_LABEL}, not the live Google SERP. Competitor rankings for a keyword are not available from any free source.`,
  };
  if (items.length === 0) {
    // Not "no organic results": the SERP certainly has results, we just have
    // no verified visibility on this query.
    result.reason = "own_site_no_impressions";
  }
  return result;
}

export async function getSerpAnalysis(
  input: {
    projectId: string;
    keyword: string;
    locationCode: number;
    languageCode: string;
  },
  billingCustomer: OrganizationContext,
): Promise<SerpAnalysisResult> {
  const keyword = normalizeKeyword(input.keyword);

  const cacheKey = await buildCacheKey("serp:analysis", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    keyword,
    locationCode: input.locationCode,
    // languageCode is part of the key even though Search Console is filtered by
    // country rather than language: the caller varies it per market, and a key
    // that ignored it would serve one market's rows for another.
    languageCode: input.languageCode,
    // No data-source discriminator: there is one source now. Dropping the field
    // changes the hash, so entries written by the deleted paid path can never
    // be read back under a key built here.
  });

  const cachedRaw = await getCached(cacheKey);
  const cached = serpCacheSchema.safeParse(cachedRaw);
  if (cached.success) {
    return cached.data;
  }

  const result = await getOwnSiteSerpAnalysis({
    projectId: input.projectId,
    keyword,
    locationCode: input.locationCode,
  });

  // waitUntil, not void: workerd cancels unregistered pending I/O once the
  // response is sent, so a fire-and-forget put never persists the cache.
  waitUntil(
    setCached(cacheKey, result, SERP_CACHE_TTL_SECONDS).catch((error) => {
      console.error("keywords.serp.cache-write failed:", error);
    }),
  );

  return result;
}
