import { z } from "zod";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import { normalizeBacklinksTarget } from "@/server/lib/backlinksTarget";
import type {
  BacklinksLookupInput,
  BacklinksRowsPageInput,
  ReferringDomainsPageInput,
  TopPagesPageInput,
} from "@/types/schemas/backlinks";

import {
  backlinksOverviewSchema,
  backlinksRowsPageResultSchema,
  referringDomainsPageResultSchema,
  topPagesPageResultSchema,
  type BacklinksOverviewResult,
  type BacklinksRowsPageResult,
  type ReferringDomainsPageResult,
  type TopPagesPageResult,
} from "@/server/features/backlinks/services/backlinksOverviewSchema";
import {
  assertFreeFiltersSupported,
  buildFreePageResult,
  filterFreeRowsByBacklinks,
  filterFreeRowsByText,
  freeAuthority,
  freeBacklinksSortField,
  freeInboundLinks,
  freeLinkingDomainAuthority,
  freeSitePages,
  isSamePage,
  keepOnePerDomain,
  resolveFreeSources,
  sortFreeRows,
  FREE_LINK_LEVEL_UNAVAILABLE,
  FREE_UNSUPPORTED_DOMAIN_FILTERS,
  FREE_UNSUPPORTED_PAGE_FILTERS,
  FREE_UNSUPPORTED_ROW_FILTERS,
} from "@/server/features/backlinks/services/backlinksFreeData";
import { AppError } from "@/server/lib/errors";
import { normaliseDomain } from "@/server/lib/free-seo/openpagerank";

// The page-request schemas carry projectId for the web middleware; the
// service layer is organization-scoped and never reads it.
export type BacklinksRowsPageServiceInput = Omit<
  BacklinksRowsPageInput,
  "projectId"
>;
export type ReferringDomainsPageServiceInput = Omit<
  ReferringDomainsPageInput,
  "projectId"
>;
export type TopPagesPageServiceInput = Omit<TopPagesPageInput, "projectId">;

const BACKLINKS_OVERVIEW_TTL_SECONDS = 6 * 60 * 60;
const BACKLINKS_TAB_TTL_SECONDS = 6 * 60 * 60;

const backlinksOverviewCacheSchema = z.object({
  overview: backlinksOverviewSchema,
});

export type BacklinksCache = {
  get(key: string): Promise<unknown>;
  set(key: string, data: unknown, ttlSeconds: number): Promise<void>;
};

type BacklinksOverviewProfile = {
  overview: BacklinksOverviewResult;
};

async function buildBacklinksOverview(input: {
  normalizedTarget: ReturnType<typeof normalizeBacklinksTarget>;
  now: Date;
  organizationId: string;
}): Promise<BacklinksOverviewResult> {
  const sources = await resolveFreeSources(input.organizationId);

  const host = normaliseDomain(input.normalizedTarget.apiTarget);
  const isDomainScope = input.normalizedTarget.scope === "domain";
  // Every free authority source rates a DOMAIN. Reporting a domain's score as
  // a single page's rank would be a different claim, so a page lookup gets no
  // rank at all rather than its domain's.
  const [authority, sitePages] = await Promise.all([
    isDomainScope ? freeAuthority(host, sources, true) : Promise.resolve(null),
    freeSitePages(host, sources),
  ]);

  const backlinks = isDomainScope
    ? // Only a complete page list can be summed into a site total. Summing one
      // page of several would look like a measurement while understating it.
      sitePages?.complete
      ? sitePages.pages.reduce((total, page) => total + page.inboundLinks, 0)
      : null
    : // Bing's count for this one page is already the page's whole total.
      (sitePages?.pages.find((page) =>
        isSamePage(page.url, input.normalizedTarget.apiTarget),
      )?.inboundLinks ?? null);

  if (
    authority?.authorityRankProxy == null &&
    authority?.referringDomains == null &&
    backlinks === null
  ) {
    // Two different situations used to raise the same NOT_CONFIGURED error with
    // the same advice, so a user who had already connected OpenPageRank was told
    // to go and connect it, and an ordinary "this domain is not in the index"
    // answer rendered as a failure. Separate them: only a genuinely missing key
    // is a configuration problem.
    const missing: string[] = [];
    if (!sources.openPageRankKey) {
      missing.push(
        "add a free OpenPageRank key in Settings for authority and referring-domain counts",
      );
    }
    if (!sources.bingApiKey) {
      missing.push(
        "verify the site in Bing Webmaster Tools and add its key to see individual links",
      );
    }

    // A source that is connected and simply holds nothing is worth saying out
    // loud too, otherwise the message reads as though that source were the
    // problem and the user re-checks a key that is already working.
    const silent: string[] = [];
    if (sources.openPageRankKey) {
      silent.push(
        "OpenPageRank is connected but holds no record of this domain, which means it is absent from Common Crawl's web graph rather than scored at zero",
      );
    }
    if (sources.bingApiKey) {
      silent.push(
        "Bing Webmaster Tools is connected but reports no links, which it only does for a site verified in that account",
      );
    }

    if (missing.length > 0) {
      const context = silent.length > 0 ? ` ${silent.join(". ")}.` : "";
      throw new AppError(
        "DATA_SOURCE_NOT_CONFIGURED",
        `No free backlink source could answer for ${host}.${context} To fix that, ${missing.join(", and ")}.`,
      );
    }

    throw new AppError(
      "NOT_FOUND",
      `No free source holds link data for ${host}. OpenPageRank only covers domains in Common Crawl's web graph, and Bing reports links only for a site verified in the connected account. This is an absence of data rather than a count of zero.`,
    );
  }

  return {
    target: input.normalizedTarget.apiTarget,
    displayTarget: input.normalizedTarget.displayTarget,
    scope: input.normalizedTarget.scope,
    summary: {
      // Authority proxy on 0-100, not a link-index rank. See webgraph.ts.
      rank: authority?.authorityRankProxy ?? null,
      backlinks,
      // Bing reports which of OUR pages are linked to, never how many pages
      // link to us, and no free source publishes the latter.
      referringPages: null,
      referringDomains: authority?.referringDomains ?? null,
      brokenBacklinks: null,
      brokenPages: null,
      backlinksSpamScore: null,
      targetSpamScore: null,
      newBacklinks: null,
      lostBacklinks: null,
      newReferringDomains: null,
      lostReferringDomains: null,
    },
    // OpenPageRank's monthly history is an authority series, so the trend
    // chart plots rank only; no free source has a backlink count per month.
    trends: isDomainScope
      ? (authority?.history ?? []).map((point) => ({
          date: point.date.slice(0, 10),
          backlinks: null,
          referringDomains: null,
          rank: point.authorityRankProxy,
        }))
      : [],
    newLostTrends: [],
    fetchedAt: input.now.toISOString(),
  };
}

async function buildBacklinksRowsPage(
  input: BacklinksRowsPageServiceInput,
  organizationId: string,
): Promise<BacklinksRowsPageResult> {
  const sources = await resolveFreeSources(organizationId);
  assertFreeFiltersSupported(input.filters, FREE_UNSUPPORTED_ROW_FILTERS);

  const normalizedTarget = normalizeBacklinksTarget(input.target, {
    scope: input.scope,
  });
  const links = await freeInboundLinks(normalizedTarget, sources);
  if (!links)
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      FREE_LINK_LEVEL_UNAVAILABLE,
    );

  const authorityByDomain = await freeLinkingDomainAuthority(links, sources);
  let rows = links.map((link) => ({
    domainFrom: normaliseDomain(link.urlFrom) || null,
    urlFrom: link.urlFrom,
    urlTo: link.urlTo,
    anchor: link.anchor,
    itemType: "anchor",
    // Bing reports the link and its anchor, never the rel attributes, so
    // follow status and spam scoring stay unavailable rather than guessed.
    isDofollow: null,
    relAttributes: [] as string[],
    rank: null,
    domainFromRank:
      authorityByDomain.get(normaliseDomain(link.urlFrom)) ?? null,
    pageFromRank: null,
    spamScore: null,
    firstSeen: null,
    lastSeen: null,
    // Bing returns links it currently sees, so nothing here is lost or broken.
    isLost: false,
    isBroken: false,
    linksCount: null,
  }));

  if (input.filters.domainFrom) {
    const wanted = normaliseDomain(input.filters.domainFrom);
    rows = rows.filter((row) => row.domainFrom === wanted);
  }
  rows = filterFreeRowsByText(rows, "urlFrom", input.filters);
  if (input.mode === "one_per_domain") rows = keepOnePerDomain(rows);

  return buildFreePageResult(
    input,
    sortFreeRows(
      rows,
      freeBacklinksSortField(input.sortField),
      input.sortOrder,
    ),
  );
}

async function buildReferringDomainsPage(
  input: ReferringDomainsPageServiceInput,
  organizationId: string,
): Promise<ReferringDomainsPageResult> {
  const sources = await resolveFreeSources(organizationId);
  assertFreeFiltersSupported(input.filters, FREE_UNSUPPORTED_DOMAIN_FILTERS);

  const normalizedTarget = normalizeBacklinksTarget(input.target, {
    scope: input.scope,
  });
  const links = await freeInboundLinks(normalizedTarget, sources);
  if (!links)
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      FREE_LINK_LEVEL_UNAVAILABLE,
    );

  const authorityByDomain = await freeLinkingDomainAuthority(links, sources);
  // Counted over the links we hold, which for a domain-scope target is the
  // sample in freeInboundLinks rather than the whole site. Every row is a real
  // domain with real links; the counts are a floor, so the tab must be labelled
  // as a sample and totalCount stays null.
  const grouped = new Map<string, { backlinks: number; pages: Set<string> }>();
  for (const link of links) {
    const domain = normaliseDomain(link.urlFrom);
    if (!domain) continue;
    const entry = grouped.get(domain) ?? { backlinks: 0, pages: new Set() };
    entry.backlinks += 1;
    entry.pages.add(link.urlFrom);
    grouped.set(domain, entry);
  }

  let rows = [...grouped].map(([domain, entry]) => ({
    domain,
    backlinks: entry.backlinks,
    referringPages: entry.pages.size,
    rank: authorityByDomain.get(domain) ?? null,
    spamScore: null,
    firstSeen: null,
    brokenBacklinks: null,
    brokenPages: null,
  }));

  rows = filterFreeRowsByText(rows, "domain", input.filters);
  rows = filterFreeRowsByBacklinks(rows, input.filters);

  return buildFreePageResult(
    input,
    sortFreeRows(rows, input.sortField, input.sortOrder),
  );
}

async function buildTopPagesPage(
  input: TopPagesPageServiceInput,
  organizationId: string,
): Promise<TopPagesPageResult> {
  const sources = await resolveFreeSources(organizationId);
  assertFreeFiltersSupported(input.filters, FREE_UNSUPPORTED_PAGE_FILTERS);

  const host = normaliseDomain(
    normalizeBacklinksTarget(input.target, { scope: input.scope }).apiTarget,
  );
  const sitePages = await freeSitePages(host, sources);
  if (!sitePages)
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      FREE_LINK_LEVEL_UNAVAILABLE,
    );

  let rows = sitePages.pages.map((page) => ({
    page: page.url,
    backlinks: page.inboundLinks,
    // Bing counts links per page, never the distinct domains behind them.
    referringDomains: null,
    rank: null,
    brokenBacklinks: null,
  }));

  rows = filterFreeRowsByText(rows, "page", input.filters);
  rows = filterFreeRowsByBacklinks(rows, input.filters);

  return buildFreePageResult(
    input,
    sortFreeRows(rows, input.sortField, input.sortOrder),
    sitePages.complete,
  );
}

export async function profileBacklinksOverview(
  cache: BacklinksCache,
  cacheKey: string,
  input: BacklinksLookupInput,
  billingCustomer: OrganizationContext,
): Promise<BacklinksOverviewProfile> {
  const cached = backlinksOverviewCacheSchema.safeParse(
    await cache.get(cacheKey),
  );
  if (cached.success) {
    return {
      overview: cached.data.overview,
    };
  }

  const overview = await buildBacklinksOverview({
    normalizedTarget: normalizeBacklinksTarget(input.target, {
      scope: input.scope,
    }),
    now: new Date(),
    organizationId: billingCustomer.organizationId,
  });
  await cacheValue(
    cache,
    cacheKey,
    { overview },
    BACKLINKS_OVERVIEW_TTL_SECONDS,
  );

  return { overview };
}

export async function profileBacklinksRowsPage(
  cache: BacklinksCache,
  cacheKey: string,
  input: BacklinksRowsPageServiceInput,
  billingCustomer: OrganizationContext,
): Promise<BacklinksRowsPageResult> {
  const cached = backlinksRowsPageResultSchema.safeParse(
    await cache.get(cacheKey),
  );
  if (cached.success) {
    return cached.data;
  }

  const result = await buildBacklinksRowsPage(
    input,
    billingCustomer.organizationId,
  );
  await cacheValue(cache, cacheKey, result, BACKLINKS_TAB_TTL_SECONDS);

  return result;
}

export async function profileReferringDomainsPage(
  cache: BacklinksCache,
  cacheKey: string,
  input: ReferringDomainsPageServiceInput,
  billingCustomer: OrganizationContext,
): Promise<ReferringDomainsPageResult> {
  const cached = referringDomainsPageResultSchema.safeParse(
    await cache.get(cacheKey),
  );
  if (cached.success) {
    return cached.data;
  }

  const result = await buildReferringDomainsPage(
    input,
    billingCustomer.organizationId,
  );
  await cacheValue(cache, cacheKey, result, BACKLINKS_TAB_TTL_SECONDS);

  return result;
}

export async function profileTopPagesPage(
  cache: BacklinksCache,
  cacheKey: string,
  input: TopPagesPageServiceInput,
  billingCustomer: OrganizationContext,
): Promise<TopPagesPageResult> {
  const cached = topPagesPageResultSchema.safeParse(await cache.get(cacheKey));
  if (cached.success) {
    return cached.data;
  }

  const result = await buildTopPagesPage(input, billingCustomer.organizationId);
  await cacheValue(cache, cacheKey, result, BACKLINKS_TAB_TTL_SECONDS);

  return result;
}

async function cacheValue(
  cache: BacklinksCache,
  key: string,
  data: unknown,
  ttlSeconds: number,
) {
  await cache.set(key, data, ttlSeconds).catch((error: unknown) => {
    console.error("backlinks.cache-write failed:", error);
  });
}
