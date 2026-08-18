/**
 * The sources behind the Backlinks feature, and the row utilities the tabs
 * assemble their tables with.
 *
 * What each number here is really made of:
 *
 *   authority ........... OpenPageRank, or the keyless Ahrefs Domain Rating.
 *                         A PROXY on 0-100, never a licensed link-index rank,
 *                         so callers must label it as such.
 *   individual links .... Bing Webmaster Tools, which reports links only for a
 *                         site verified in the caller's own Bing account. For
 *                         any other target the answer is null, which means
 *                         "not knowable here" and never "no backlinks".
 *   everything else ..... spam score, follow status, first/last seen, broken
 *                         links. No free source publishes these, so they stay
 *                         null rather than being scored or estimated.
 */

import { AppError } from "@/server/lib/errors";
import { createFreeSeoProvider } from "@/server/lib/free-seo/provider";
import { normaliseDomain } from "@/server/lib/free-seo/openpagerank";
import {
  fetchAhrefsDomainRating,
  fetchBingInboundLinks,
  fetchOpenPageRankBulk,
  parseBingLinkCounts,
  scaleOpenPageRank,
  type DomainAuthorityProxy,
  type InboundLink,
  type SiteInboundPages,
} from "@/server/lib/free-seo/webgraph";
import type { normalizeBacklinksTarget } from "@/server/lib/backlinksTarget";

/**
 * How many of a verified site's most-linked pages we pull individual links
 * for. Each page costs one Bing request, so this bounds a table build to a
 * handful of subrequests. Bing orders the page list by inbound-link count, so
 * the sample is the site's most linked-to pages rather than an arbitrary cut.
 */
const FREE_LINK_SAMPLE_PAGES = 5;

export const FREE_LINK_LEVEL_UNAVAILABLE =
  "Individual backlinks, referring domains and anchor text come from Bing Webmaster Tools, which reports links only for sites verified in your own Bing account. No free source publishes link level data for a site you do not own. Add a free Bing Webmaster key in Settings and verify this site to fill this tab.";

/**
 * Filter controls the free tables cannot evaluate, keyed by request field and
 * named as the user sees them. Spam score, link authority and follow status
 * are columns no free source fills at all; domain rank is filled only for the
 * links whose domain OpenPageRank happens to know, which is not enough to
 * decide which rows a rank cutoff removes.
 */
export const FREE_UNSUPPORTED_ROW_FILTERS = {
  minDomainRank: "domain rank",
  maxDomainRank: "domain rank",
  minLinkAuthority: "link authority",
  maxLinkAuthority: "link authority",
  minSpamScore: "spam score",
  maxSpamScore: "spam score",
  linkType: "link type",
};

export const FREE_UNSUPPORTED_DOMAIN_FILTERS = {
  minRank: "rank",
  maxRank: "rank",
  minSpamScore: "spam score",
  maxSpamScore: "spam score",
};

export const FREE_UNSUPPORTED_PAGE_FILTERS = {
  minRank: "rank",
  maxRank: "rank",
  minReferringDomains: "referring domains",
  maxReferringDomains: "referring domains",
};

type FreeBacklinksSources = {
  bingApiKey: string | null;
  openPageRankKey: string | null;
};

/**
 * The keys this organization has connected.
 *
 * Mirrors `tryFreeResearchRows` in the keywords feature, including the dynamic
 * import: provider-keys reaches the database, and the pure row mappers in this
 * module are unit-tested with no database binding.
 */
export async function resolveFreeSources(
  organizationId: string,
): Promise<FreeBacklinksSources> {
  const { resolveProviderKey } =
    await import("@/server/features/provider-keys/providerKeys");
  const [bing, openPageRank] = await Promise.all([
    resolveProviderKey(organizationId, "bing"),
    resolveProviderKey(organizationId, "openpagerank"),
  ]);
  return {
    bingApiKey: bing?.secret ?? null,
    openPageRankKey: openPageRank?.secret ?? null,
  };
}

/**
 * Authority for any domain, on 0-100. This is an authority PROXY, not a
 * licensed link-index rank: OpenPageRank first (it also carries a referring-domain
 * count and a monthly history), then the keyless Ahrefs Domain Rating so a
 * install with no keys at all still shows a real number.
 */
export async function freeAuthority(
  host: string,
  sources: FreeBacklinksSources,
  includeHistory: boolean,
): Promise<DomainAuthorityProxy> {
  const empty: DomainAuthorityProxy = {
    domain: host,
    authorityRankProxy: null,
    referringDomains: null,
    history: [],
  };

  if (sources.openPageRankKey) {
    const bulk = await fetchOpenPageRankBulk({
      apiKey: sources.openPageRankKey,
      domains: [host],
      includeHistory,
    });
    const row = bulk?.get(host);
    if (row?.authorityRankProxy != null) return row;
    if (row) {
      // OpenPageRank answered but has never scored this domain. Its
      // referring-domain count is still real, and the keyless Ahrefs rating
      // may still know the domain, so ask before settling for no number.
      return {
        ...row,
        authorityRankProxy: await fetchAhrefsDomainRating({ domain: host }),
      };
    }

    // A legacy v1.0 key answers on the old endpoint only: a score, with no
    // referring-domain count and no history. A key the old endpoint also
    // rejects must not take the page down while a keyless source can answer.
    try {
      const free = createFreeSeoProvider({
        OPENPAGERANK_API_KEY: sources.openPageRankKey,
      });
      const [legacy] = await free.domainAuthority([host]);
      if (legacy?.pageRank != null) {
        return {
          ...empty,
          authorityRankProxy: scaleOpenPageRank(legacy.pageRank),
        };
      }
    } catch {
      // Falls through to the keyless source below.
    }
  }

  return {
    ...empty,
    authorityRankProxy: await fetchAhrefsDomainRating({ domain: host }),
  };
}

/** Bing's site URL for a bare host. Verification is registered on the root. */
function bingSiteUrl(host: string): string {
  return `https://${host}/`;
}

/** Bing echoes its own protocol and trailing slash, so compare on the rest. */
export function isSamePage(a: string, b: string): boolean {
  return stripPageUrl(a) === stripPageUrl(b);
}

function stripPageUrl(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

/**
 * Pages of the target site that Bing has seen inbound links to, or null when
 * the target is not verified in this Bing account. Null is the normal answer
 * for a competitor lookup and must never be reported as "no backlinks".
 */
export async function freeSitePages(
  host: string,
  sources: FreeBacklinksSources,
): Promise<SiteInboundPages | null> {
  if (!sources.bingApiKey) return null;

  const free = createFreeSeoProvider({
    BING_WEBMASTER_API_KEY: sources.bingApiKey,
  });
  try {
    return parseBingLinkCounts(await free.ownSiteLinkCounts(bingSiteUrl(host)));
  } catch {
    // Bing answers with a fault for a site this key has not verified.
    return null;
  }
}

/**
 * Real inbound links with anchor text, or null when the target is not a
 * verified site. A page-scope target is asked for directly; a domain-scope
 * target samples its most linked-to pages.
 */
export async function freeInboundLinks(
  normalizedTarget: ReturnType<typeof normalizeBacklinksTarget>,
  sources: FreeBacklinksSources,
): Promise<InboundLink[] | null> {
  const apiKey = sources.bingApiKey;
  if (!apiKey) return null;

  const host = normaliseDomain(normalizedTarget.apiTarget);
  const siteUrl = bingSiteUrl(host);

  if (normalizedTarget.scope === "page") {
    return fetchBingInboundLinks({
      apiKey,
      siteUrl,
      pageUrl: normalizedTarget.apiTarget,
    });
  }

  const sitePages = await freeSitePages(host, sources);
  if (!sitePages) return null;

  const sampled = sitePages.pages
    .toSorted((a, b) => b.inboundLinks - a.inboundLinks)
    .slice(0, FREE_LINK_SAMPLE_PAGES);
  const perPage = await Promise.all(
    sampled.map((page) =>
      fetchBingInboundLinks({ apiKey, siteUrl, pageUrl: page.url }),
    ),
  );
  return perPage.flatMap((links) => links ?? []);
}

/**
 * Authority for the domains that link to the target, so the table's rank
 * column is real rather than blank. Only OpenPageRank can answer a batch in
 * one request; without it the column stays null and the client's existing
 * keyless Ahrefs lookup fills the Domain Rating column instead.
 */
export async function freeLinkingDomainAuthority(
  links: InboundLink[],
  sources: FreeBacklinksSources,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (!sources.openPageRankKey) return out;

  const domains = [
    ...new Set(links.map((link) => normaliseDomain(link.urlFrom))),
  ].filter(Boolean);
  const bulk = await fetchOpenPageRankBulk({
    apiKey: sources.openPageRankKey,
    domains,
  });
  for (const [domain, row] of bulk ?? []) {
    out.set(domain, row.authorityRankProxy);
  }
  return out;
}

/** The rows sort field names differ from the row keys for one column only. */
export function freeBacklinksSortField(sortField: string): string {
  return sortField === "domainRank" ? "domainFromRank" : sortField;
}

/**
 * Free rows are paginated in memory: neither Bing nor OpenPageRank accepts an
 * offset over an assembled link table. `totalCount` stays null unless the
 * underlying list is known to be complete, so the UI never prints a total we
 * cannot stand behind.
 */
export function buildFreePageResult<TRow>(
  input: { page: number; pageSize: number },
  rows: TRow[],
  complete = false,
) {
  const offset = (input.page - 1) * input.pageSize;
  const pageRows = rows.slice(offset, offset + input.pageSize);

  return {
    rows: pageRows,
    totalCount: complete ? rows.length : null,
    // The whole list is already in memory, so whether another page exists is
    // known exactly rather than guessed from a full page of rows.
    hasMore: offset + pageRows.length < rows.length,
    page: input.page,
    pageSize: input.pageSize,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Refuses a filter the free tables cannot evaluate. Ignoring one would return
 * unfiltered rows under an active filter chip, which reads as "these are the
 * links that match" when it is really "these are all the links".
 */
export function assertFreeFiltersSupported(
  filters: object,
  unsupported: Record<string, string>,
): void {
  const blocked = new Set<string>();
  for (const [field, label] of Object.entries(unsupported)) {
    const value: unknown = Reflect.get(filters, field);
    if (value !== undefined && value !== "") blocked.add(label);
  }
  if (blocked.size === 0) return;

  throw new AppError(
    "DATA_SOURCE_NOT_CONFIGURED",
    `Free sources cannot fill the ${[...blocked].join(" and ")} column for every link, so filtering on it would hide real links for no stated reason. Clear that filter to see the links Bing Webmaster Tools reports.`,
  );
}

export function filterFreeRowsByText<TRow>(
  rows: TRow[],
  field: keyof TRow & string,
  filters: { include?: string; exclude?: string },
): TRow[] {
  const include = filters.include?.trim().toLowerCase();
  const exclude = filters.exclude?.trim().toLowerCase();
  if (!include && !exclude) return rows;

  return rows.filter((row) => {
    const value = String(row[field] ?? "").toLowerCase();
    if (include && !value.includes(include)) return false;
    if (exclude && value.includes(exclude)) return false;
    return true;
  });
}

export function filterFreeRowsByBacklinks<
  TRow extends { backlinks: number | null },
>(
  rows: TRow[],
  filters: { minBacklinks?: number; maxBacklinks?: number },
): TRow[] {
  // Only the backlink count is filterable in free mode. Rank, spam score and
  // referring-domain filters address columns no free source fills, so they are
  // left alone rather than silently emptying the table.
  return rows.filter(
    (row) =>
      row.backlinks !== null &&
      (filters.minBacklinks === undefined ||
        row.backlinks >= filters.minBacklinks) &&
      (filters.maxBacklinks === undefined ||
        row.backlinks <= filters.maxBacklinks),
  );
}

/** The `one_per_domain` grouping, applied to rows assembled in free mode. */
export function keepOnePerDomain<TRow extends { domainFrom: string | null }>(
  rows: TRow[],
): TRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const domain = row.domainFrom ?? "";
    if (seen.has(domain)) return false;
    seen.add(domain);
    return true;
  });
}

export function sortFreeRows<TRow extends object>(
  rows: TRow[],
  field: string,
  order: string,
): TRow[] {
  const direction = order === "asc" ? 1 : -1;
  return rows.toSorted(
    (a, b) =>
      compareFreeValues(Reflect.get(a, field), Reflect.get(b, field)) *
      direction,
  );
}

function compareFreeValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  // Whole columns are null in free mode. Sorting by one of those keeps the
  // source order instead of inventing a ranking nobody can see.
  return 0;
}
