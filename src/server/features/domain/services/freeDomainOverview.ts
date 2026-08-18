/**
 * Domain Overview on the free stack.
 *
 * The paid path answers "what does this domain RANK for, and how much traffic
 * does that earn". Both halves of that sentence come from a licensed rank
 * index plus a click-through model. No free source sells either, so this
 * module does NOT attempt to reproduce them: every such number is returned as
 * null with a user-facing reason attached, and the caller renders the reason.
 *
 * What is genuinely free, and what each field here is built from:
 *
 *   keywords a domain targets .. Google Ads keyword ideas with a URL seed.
 *                                Real Google volume and real CPC, from
 *                                Google's own association model.
 *   domain authority ........... OpenPageRank (0-10).
 *   page inventory ............. Common Crawl, so zero requests hit the
 *                                domain's own server.
 *   position and traffic ....... NOT AVAILABLE. Our own site's real positions
 *                                come from Search Console, which covers
 *                                verified properties only and is wired
 *                                elsewhere; for a third-party domain there is
 *                                nothing free and licensed to read.
 *
 * The honesty rule this file exists to enforce: a number we cannot source is
 * null plus a reason, never 0 and never an estimate. A zero CPC reads as "free
 * to advertise on" and a zero traffic reads as "this site is dead", and both
 * are claims we have no evidence for.
 */

import { z } from "zod";

import { AppError } from "@/server/lib/errors";
import { createFreeSeoProvider } from "@/server/lib/free-seo/provider";
import { buildCompetitorFootprint } from "@/server/lib/free-seo/competitor-footprint";
import { createCommonCrawlClient } from "@/server/lib/free-seo/commoncrawl";
import { toRelativePath } from "@/server/lib/domainUtils";
import { resolveFreeSeoEnv } from "@/server/lib/free-seo/resolveFreeSeoEnv";
import type { DomainKeywordsFilters } from "@/types/schemas/domain";
import type {
  DomainKeywordsSortMode,
  DomainKeywordsSortOrder,
} from "@/server/features/domain/services/domainKeywordFilters";

/**
 * User-facing copy for every number the free stack cannot produce. These
 * strings are rendered to the user verbatim, so they name the missing source
 * and say what would fix it rather than apologising.
 */
const FREE_UNAVAILABLE = {
  organicTraffic:
    "Estimated organic traffic is unavailable on the free stack. It is modelled from ranked positions and a click-through curve, and no free source publishes either for a domain you do not own.",
  organicKeywords:
    "The number of keywords this domain ranks for is unavailable on the free stack. Ranked positions for a third-party domain need a licensed rank index. The keywords the domain targets are shown instead.",
  backlinks:
    "Backlink counts are unavailable on the free stack for a third-party domain. Bing Webmaster reports links only for sites you have verified.",
  referringDomains:
    "Referring domain counts are unavailable on the free stack for a third-party domain. Bing Webmaster reports links only for sites you have verified.",
  position:
    "Position is unavailable on the free stack for a domain you do not own. Search Console reports real positions for your own verified site only.",
  keywordTraffic:
    "Per-keyword traffic is unavailable on the free stack. It is modelled from position and a click-through curve, and neither is free for a third-party domain.",
  keywordDifficulty:
    "Keyword difficulty is unavailable in this view on the free stack. The free proxy scores the authority of the domains currently ranking, which needs one SERP per keyword.",
  keywordUrl:
    "The ranking URL is unavailable on the free stack. Google Ads reports the keywords a site is associated with, not which page of it would rank.",
  pageTraffic:
    "Per-page traffic and keyword counts are unavailable on the free stack. Common Crawl lists the pages a site publishes, not how they perform.",
  ignoredKeywordFilters:
    "Filters on position, traffic and difficulty were not applied: those values are unavailable on the free stack, so filtering by them would hide every row.",
  ignoredPageFilters:
    "Filters on traffic and keyword count were not applied: those values are unavailable on the free stack, so filtering by them would hide every row.",
  keywordSort:
    "Sorted by search volume. Sorting by position, traffic or difficulty needs values the free stack cannot produce.",
  pageSort:
    "Sorted by URL. Sorting by traffic or keyword count needs values the free stack cannot produce.",
  pagesSourceDown:
    "Common Crawl did not answer, so the page list is unavailable right now. This is a temporary outage of a donation-funded index, not a sign that the domain has no pages.",
  openPageRankNotConnected:
    "Domain authority is unavailable because OpenPageRank is not connected. Add a free OpenPageRank API key to score any domain from 0 to 10.",
  openPageRankUnknownDomain:
    "OpenPageRank holds no authority score for this domain. Its index is large but not complete, so this is an absence of data rather than a score of zero.",
  googleAdsNotConnected:
    "The keywords this domain targets are unavailable because Google Ads is not connected. Add free Google Ads API credentials, including the customer id, to read them. No ad spend is needed.",
} as const;

/**
 * Provenance copy for the rows the free stack CAN produce. These are proxies
 * for what the paid path shows, so the user has to be told which question the
 * numbers answer before reading them as ranking data.
 */
export const FREE_SOURCE_LABEL = {
  overview:
    "Free stack: domain authority from OpenPageRank, and the keywords Google Ads associates with this domain. Ranked positions, traffic and backlinks need a licensed index and are shown as unavailable.",
  keywords:
    "These are the keywords Google Ads associates with this domain, which is what the site TARGETS, not what it ranks for. Search volume and CPC are real Google numbers.",
  pages:
    "These are the pages Common Crawl has indexed for this domain, so the list is what the site PUBLISHES, not what earns traffic. Reading it sends no requests to the site itself.",
} as const;

/**
 * The free-stack annotations that ride along with a domain result. Optional on
 * every result schema so a payload cached by the paid path still parses.
 */
export const freeDomainNoteSchema = z.object({
  /** Field name to user-facing reason. Render these instead of a zero. */
  unavailable: z.record(z.string(), z.string()),
  /**
   * Which free source the rows came from and what question it answers. Render
   * it with the table: "keywords a site targets" and "keywords a site ranks
   * for" are different claims and the columns alone cannot tell them apart.
   * Optional so a payload cached before this field existed still parses.
   */
  source: z.string().optional(),
  /**
   * True when the free source capped the rows it returned, so any count built
   * from them is a floor and never a total.
   */
  truncated: z.boolean(),
});

export const freeDomainOverviewSchema = freeDomainNoteSchema.extend({
  /** OpenPageRank's 0-10 authority. */
  openPageRankAuthority: z.number().nullable(),
  /**
   * How many keywords Google Ads associates with this domain's URL. These are
   * keywords the domain TARGETS, not keywords it ranks for, and any label
   * shown to the user has to say so.
   */
  googleAdsTargetedKeywords: z.number().nullable(),
});

type FreeDomainOverview = z.infer<typeof freeDomainOverviewSchema>;

/**
 * A keyword row on the free stack. `position`, `traffic`, `url` and
 * `keywordDifficulty` are typed as the literal null, so a future edit that
 * tries to fill one of them with a modelled number fails to compile.
 */
export type FreeDomainKeywordRow = {
  keyword: string;
  position: null;
  /** Real Google average monthly searches, bucketed by Google without spend. */
  searchVolume: number | null;
  traffic: null;
  /** Real Google top-of-page bid midpoint. */
  cpc: number | null;
  url: null;
  relativeUrl: null;
  keywordDifficulty: null;
};

type FreeDomainPageRow = {
  page: string;
  relativePath: string | null;
  organicTraffic: null;
  keywords: null;
};

/**
 * Builds the free provider from this organization's stored keys.
 *
 * provider-keys is imported dynamically because it reaches the database, and
 * the pure filter/sort helpers below are unit-tested with no D1 binding.
 */
async function resolveFreeStack(organizationId: string) {
  const env = await resolveFreeSeoEnv(organizationId);
  const provider = createFreeSeoProvider(env);
  return {
    provider,
    hasOpenPageRank: Boolean(env.OPENPAGERANK_API_KEY),
    // A stored Google Ads secret is not the same as a usable one: the provider
    // builds a client only when the credential JSON parses AND the customer id
    // is set, and without a client competitorKeywords returns an empty list.
    // Asking the provider what it actually holds keeps a half-entered key from
    // rendering as "this domain targets 0 keywords".
    hasGoogleAds: provider.volumeSource === "google_ads",
  };
}

const NO_KEYWORD_SOURCE =
  "No domain keyword source is connected. Add Microsoft Advertising or Google Ads to see the keywords a domain targets, with real volume and CPC. Both are free and need no ad spend. Microsoft needs no approval wait. If you already added a key, check that the account or customer id is filled in too.";

/**
 * How many keyword ideas to ask Google for. A count built from a capped list
 * is a floor, so the cap is set high enough that hitting it is itself news
 * (reported as `truncated`) rather than the normal case.
 */
const GOOGLE_ADS_IDEA_LIMIT = 1000;

/**
 * Free-mode overview, or null when the paid path should run.
 *
 * Throws DATA_SOURCE_NOT_CONFIGURED when nothing at all is connected, so the
 * user gets a fix rather than "an unexpected error occurred".
 */
export async function tryFreeDomainOverview(input: {
  domain: string;
  locationCode: number;
  organizationId: string;
}): Promise<FreeDomainOverview> {
  const { provider, hasOpenPageRank, hasGoogleAds } = await resolveFreeStack(
    input.organizationId,
  );

  if (!hasOpenPageRank && !hasGoogleAds) {
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      "No domain data source is connected. Add Microsoft Advertising or Google Ads for the keywords a domain targets, and OpenPageRank for domain authority. All are free.",
    );
  }

  // Independent sources, so one being slow must not serialise the other.
  const [authorities, targeted] = await Promise.all([
    hasOpenPageRank ? provider.domainAuthority([input.domain]) : [],
    hasGoogleAds
      ? provider.competitorKeywords({
          url: `https://${input.domain}`,
          locationCode: input.locationCode,
          limit: GOOGLE_ADS_IDEA_LIMIT,
        })
      : [],
  ]);

  const unavailable: Record<string, string> = {
    organicTraffic: FREE_UNAVAILABLE.organicTraffic,
    organicKeywords: FREE_UNAVAILABLE.organicKeywords,
    backlinks: FREE_UNAVAILABLE.backlinks,
    referringDomains: FREE_UNAVAILABLE.referringDomains,
  };

  // The two cards this path CAN fill also need a reason when they come back
  // empty, otherwise a missing key and an unscored domain both render as a
  // blank card and the user cannot tell which one to act on.
  const openPageRankAuthority = authorities[0]?.pageRank ?? null;
  if (!hasOpenPageRank) {
    unavailable.openPageRankAuthority =
      FREE_UNAVAILABLE.openPageRankNotConnected;
  } else if (openPageRankAuthority === null) {
    unavailable.openPageRankAuthority =
      FREE_UNAVAILABLE.openPageRankUnknownDomain;
  }
  if (!hasGoogleAds) {
    unavailable.googleAdsTargetedKeywords =
      FREE_UNAVAILABLE.googleAdsNotConnected;
  }

  return {
    openPageRankAuthority,
    googleAdsTargetedKeywords: hasGoogleAds ? targeted.length : null,
    unavailable,
    source: FREE_SOURCE_LABEL.overview,
    truncated: targeted.length >= GOOGLE_ADS_IDEA_LIMIT,
  };
}

/**
 * Free-mode keyword rows for a domain, or null when the paid path should run.
 * Shared by the overview's suggestion list and the paginated keywords tab so
 * the two can never disagree about what is knowable.
 */
export async function tryFreeDomainKeywords(input: {
  domain: string;
  locationCode: number;
  organizationId: string;
}): Promise<{ rows: FreeDomainKeywordRow[]; truncated: boolean }> {
  const { provider, hasGoogleAds } = await resolveFreeStack(
    input.organizationId,
  );
  if (!hasGoogleAds) {
    throw new AppError("DATA_SOURCE_NOT_CONFIGURED", NO_KEYWORD_SOURCE);
  }

  const ideas = await provider.competitorKeywords({
    // The URL seed wants a URL, and the domain is stored bare.
    url: `https://${input.domain}`,
    locationCode: input.locationCode,
    limit: GOOGLE_ADS_IDEA_LIMIT,
  });

  return {
    rows: ideas.map((idea) => ({
      keyword: idea.keyword,
      // Google Ads says which keywords a site is associated with, never where
      // it sits on the SERP for them.
      position: null,
      searchVolume: idea.searchVolume,
      traffic: null,
      cpc: idea.cpc,
      url: null,
      relativeUrl: null,
      keywordDifficulty: null,
    })),
    truncated: ideas.length >= GOOGLE_ADS_IDEA_LIMIT,
  };
}

/**
 * Free-mode page inventory, or null when the paid path should run.
 *
 * Needs no key: Common Crawl is open data. A failed crawl fetch is reported as
 * `pagesSourceDown` rather than as an empty site, because those two are
 * different claims and only one of them is ever true here.
 *
 * Page content is deliberately not fetched (`contentLimit: 0`). Titles would
 * cost one ranged WARC read per page, sequentially, which no request path can
 * afford; the URL inventory is the part this view renders.
 */
export async function tryFreeDomainPages(input: { domain: string }): Promise<{
  rows: FreeDomainPageRow[];
  truncated: boolean;
  /** Common Crawl failed rather than answered. Callers must not count rows. */
  sourceDown: boolean;
  unavailable: Record<string, string>;
}> {
  const footprint = await buildCompetitorFootprint(input.domain, {
    contentLimit: 0,
    // The default client is tuned for a monthly batch job: three attempts at
    // two minutes each. Someone is watching a table load here, so the wait is
    // bounded and a miss is reported as an outage rather than held open.
    client: createCommonCrawlClient({
      cdxAttempts: 2,
      cdxTimeoutMs: 25_000,
    }),
  });

  const unavailable: Record<string, string> = {
    organicTraffic: FREE_UNAVAILABLE.pageTraffic,
    keywords: FREE_UNAVAILABLE.pageTraffic,
  };
  if (footprint.unavailable) {
    unavailable.pages = FREE_UNAVAILABLE.pagesSourceDown;
  }

  return {
    rows: footprint.pages.map((page) => ({
      page: page.url,
      relativePath: toRelativePath(page.url),
      organicTraffic: null,
      keywords: null,
    })),
    truncated: footprint.truncated,
    sourceDown: footprint.unavailable,
    unavailable,
  };
}

function includesTerm(haystack: string, term: string): boolean {
  return haystack.toLowerCase().includes(term.toLowerCase());
}

function parseTerms(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,+]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function withinRange(
  value: number | null,
  min: number | undefined,
  max: number | undefined,
): boolean {
  if (min === undefined && max === undefined) return true;
  // A row whose value is unknown cannot be shown to satisfy a bound. Dropping
  // it is the honest read of "volume above 100"; keeping it would assert a
  // number we do not have.
  if (value === null) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/** Filters the free stack cannot evaluate, because the column is always null. */
function usesUnavailableKeywordFilter(filters: DomainKeywordsFilters): boolean {
  return [
    filters.minTraffic,
    filters.maxTraffic,
    filters.minKd,
    filters.maxKd,
    filters.minRank,
    filters.maxRank,
  ].some((value) => value !== undefined);
}

function usesUnavailablePageFilter(filters: DomainKeywordsFilters): boolean {
  return [
    filters.minTraffic,
    filters.maxTraffic,
    filters.minVol,
    filters.maxVol,
  ].some((value) => value !== undefined);
}

/** The only two columns the free stack can sort keywords by. */
const FREE_KEYWORD_SORT_FIELD: Record<
  DomainKeywordsSortMode,
  "searchVolume" | "cpc" | null
> = {
  rank: null,
  traffic: null,
  score: null,
  volume: "searchVolume",
  cpc: "cpc",
};

/**
 * Applies the user's filters, search and sort to free keyword rows in memory.
 *
 * The paid path pushed all three down to the provider. Here the whole result set
 * is already in hand (one Google Ads call returns every idea it has), so doing
 * it locally is both simpler and cheaper than paging a remote query.
 */
export function applyFreeKeywordQuery(
  rows: FreeDomainKeywordRow[],
  input: {
    filters: DomainKeywordsFilters;
    search?: string;
    sortMode: DomainKeywordsSortMode;
    sortOrder: DomainKeywordsSortOrder;
  },
): { rows: FreeDomainKeywordRow[]; unavailable: Record<string, string> } {
  const { filters } = input;
  const includes = parseTerms(filters.include);
  const excludes = parseTerms(filters.exclude);
  const search = input.search?.trim();

  const filtered = rows.filter((row) => {
    if (
      includes.length > 0 &&
      !includes.every((t) => includesTerm(row.keyword, t))
    ) {
      return false;
    }
    if (excludes.some((t) => includesTerm(row.keyword, t))) return false;
    if (search && !includesTerm(row.keyword, search)) return false;
    if (!withinRange(row.searchVolume, filters.minVol, filters.maxVol)) {
      return false;
    }
    if (!withinRange(row.cpc, filters.minCpc, filters.maxCpc)) return false;
    return true;
  });

  const field = FREE_KEYWORD_SORT_FIELD[input.sortMode];
  const sortField = field ?? "searchVolume";
  // An unsupported sort column always falls back to volume descending, which is
  // the free stack's most meaningful order, so the requested direction is only
  // honoured for a column that exists.
  const ascending = field !== null && input.sortOrder === "asc";
  const sorted = filtered.toSorted((a, b) => {
    const left = a[sortField];
    const right = b[sortField];
    // Volume ties are common because Google buckets the numbers; the keyword
    // is the tiebreaker so pagination stays stable across requests.
    const tiebreak = a.keyword.localeCompare(b.keyword);
    // Unknown values sort last in BOTH directions, which is why the null test
    // sits outside the direction flip: a null is an absence, not a small
    // number, and it must never lead an ascending list as if it were zero.
    if (left === null || right === null) {
      if (left === right) return tiebreak;
      return left === null ? 1 : -1;
    }
    const byValue = ascending ? left - right : right - left;
    return byValue !== 0 ? byValue : tiebreak;
  });

  const unavailable: Record<string, string> = {
    position: FREE_UNAVAILABLE.position,
    traffic: FREE_UNAVAILABLE.keywordTraffic,
    keywordDifficulty: FREE_UNAVAILABLE.keywordDifficulty,
    url: FREE_UNAVAILABLE.keywordUrl,
  };
  if (field === null) unavailable.sort = FREE_UNAVAILABLE.keywordSort;
  if (usesUnavailableKeywordFilter(filters)) {
    unavailable.filters = FREE_UNAVAILABLE.ignoredKeywordFilters;
  }

  return { rows: sorted, unavailable };
}

/**
 * Same idea for pages. Neither of the two sort columns the UI offers exists on
 * the free stack, so the order is by URL and the user is told why.
 */
export function applyFreePageQuery(
  rows: FreeDomainPageRow[],
  input: { filters: DomainKeywordsFilters; search?: string },
): { rows: FreeDomainPageRow[]; unavailable: Record<string, string> } {
  const { filters } = input;
  const includes = parseTerms(filters.include);
  const excludes = parseTerms(filters.exclude);
  const search = input.search?.trim();

  const filtered = rows.filter((row) => {
    if (
      includes.length > 0 &&
      !includes.every((t) => includesTerm(row.page, t))
    ) {
      return false;
    }
    if (excludes.some((t) => includesTerm(row.page, t))) return false;
    if (search && !includesTerm(row.page, search)) return false;
    return true;
  });

  const unavailable: Record<string, string> = {
    sort: FREE_UNAVAILABLE.pageSort,
  };
  if (usesUnavailablePageFilter(filters)) {
    unavailable.filters = FREE_UNAVAILABLE.ignoredPageFilters;
  }

  return {
    rows: filtered.toSorted((a, b) => a.page.localeCompare(b.page)),
    unavailable,
  };
}
