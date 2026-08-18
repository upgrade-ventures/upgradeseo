/**
 * Free web-graph data for the Backlinks feature.
 *
 * WHAT A CLOUDFLARE WORKER CAN AND CANNOT DO HERE, stated plainly so nobody
 * wires this to something that will time out:
 *
 *   ✓ Authority for ANY domain ............ OpenPageRank's bulk endpoint, or
 *                                           the keyless Ahrefs free Domain
 *                                           Rating endpoint. One request each.
 *   ✓ Referring-domain COUNT for ANY domain  OpenPageRank's bulk endpoint
 *                                           returns `referring_domains`. The
 *                                           legacy v1.0 endpoint that
 *                                           openpagerank.ts speaks does NOT,
 *                                           so a legacy key yields a score
 *                                           with no count and no history.
 *   ✓ Link-level rows WITH anchor text .... Bing Webmaster `GetUrlLinks`,
 *                                           VERIFIED SITES ONLY. This is the
 *                                           only free source of an actual
 *                                           referring URL and its anchor.
 *   ✗ Link-level rows for a third party ... no free source returns them, at
 *                                           any price of effort. Callers must
 *                                           surface that as unavailable rather
 *                                           than as an empty table.
 *   ✗ Common Crawl webgraph, per request .. the rank files are live (a Range
 *                                           probe of .../hyperlinkgraph/
 *                                           cc-main-2024-feb-apr-may/domain/
 *                                           cc-main-2024-feb-apr-may-domain-
 *                                           ranks.txt.gz answered HTTP 206 on
 *                                           2026-08-16) but they are
 *                                           multi-gigabyte gzip streams sorted
 *                                           by reversed host with no index,
 *                                           and the transposed BVGraph that
 *                                           holds the actual inbound edges is
 *                                           larger still. One lookup means
 *                                           streaming the whole file, so it
 *                                           belongs in a batch job that writes
 *                                           its own index, never in a request.
 *
 * Every number here is measured by a free source or it is null. Nothing in
 * this module estimates, interpolates, or defaults to zero.
 */

import { z } from "zod";

const OPR_BULK_ENDPOINT =
  "https://openpagerank.keywordseverywhere.com/v1/domains/bulk";
const AHREFS_DR_ENDPOINT =
  "https://api.ahrefs.com/v3/public/domain-rating-free";
const BING_JSON_BASE = "https://ssl.bing.com/webmaster/api.svc/json";

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * OpenPageRank issues two key formats. The bulk endpoint (the only one that
 * reports referring domains) takes a bearer token with this prefix; the older
 * v1.0 endpoint takes a bare hex key in an `API-OPR` header and is what
 * openpagerank.ts already speaks. Sniffing the prefix lets one stored key work
 * on whichever endpoint it belongs to, with no config change.
 */
const OPR_BULK_KEY_PREFIX = "opr_live_";

/** Bing paginates inbound links; enough pages to fill a table, not a crawl. */
const DEFAULT_BING_LINK_PAGES = 3;

/**
 * Authority for one domain, expressed on 0-100.
 *
 * `authorityRankProxy` is a PROXY, never a licensed link-index rank: it is
 * either OpenPageRank's 0-10 score times ten, or Ahrefs' free Domain Rating.
 * Callers must label it as an authority estimate in user-facing copy.
 */
export interface DomainAuthorityProxy {
  domain: string;
  authorityRankProxy: number | null;
  /** Referring domains as counted by OpenPageRank. Null when unavailable. */
  referringDomains: number | null;
  /** Monthly authority points, oldest first. Empty when unavailable. */
  history: Array<{ date: string; authorityRankProxy: number }>;
}

/** One real inbound link, as reported by Bing for a verified site. */
export interface InboundLink {
  urlFrom: string;
  urlTo: string;
  /** Bing reports the anchor text; empty anchors come back as null. */
  anchor: string | null;
}

/** Pages of a verified site that Bing has seen inbound links to. */
export interface SiteInboundPages {
  pages: Array<{ url: string; inboundLinks: number }>;
  /**
   * True when the fetched rows are the WHOLE list, so summing them is a real
   * total. Bing paginates, and summing one page of many would understate the
   * site's link count while looking like a measurement.
   */
  complete: boolean;
}

const oprBulkResponseSchema = z.object({
  results: z
    .array(
      z.object({
        domain: z.string(),
        found: z.boolean().optional(),
        open_page_rank: z.number().nullable().optional(),
        referring_domains: z.number().nullable().optional(),
        history: z
          .array(
            z.object({
              date: z.string(),
              open_page_rank: z.number(),
            }),
          )
          .optional(),
      }),
    )
    .default([]),
});

const ahrefsResponseSchema = z.object({
  domain_rating: z.object({
    domain_rating: z.number().min(0).max(100),
  }),
});

/** OpenPageRank scores 0-10; the backlinks tables show authority on 0-100. */
export function scaleOpenPageRank(score: number): number {
  return Math.round(score * 100) / 10;
}

/**
 * Authority, referring-domain counts and monthly history for up to 100
 * domains in one request.
 *
 * Returns null when the stored key belongs to the legacy endpoint, or when the
 * call fails. Null means "ask another source", never "this domain has no
 * links": the caller falls back rather than rendering a zero.
 */
export async function fetchOpenPageRankBulk(input: {
  apiKey: string;
  domains: string[];
  includeHistory?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<Map<string, DomainAuthorityProxy> | null> {
  if (!input.apiKey.startsWith(OPR_BULK_KEY_PREFIX)) return null;
  if (input.domains.length === 0) return new Map();

  const doFetch = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(OPR_BULK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        domains: input.domains.slice(0, 100),
        include_history: input.includeHistory ?? false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const parsed = oprBulkResponseSchema.safeParse(await response.json());
  if (!parsed.success) return null;

  const out = new Map<string, DomainAuthorityProxy>();
  for (const row of parsed.data.results) {
    // `found: false` is OpenPageRank's "we have never crawled this", and it
    // ships alongside zeroes. Those zeroes are absence, not a measurement.
    const known = row.found !== false;
    out.set(row.domain, {
      domain: row.domain,
      authorityRankProxy:
        known && row.open_page_rank != null
          ? scaleOpenPageRank(row.open_page_rank)
          : null,
      referringDomains: known ? (row.referring_domains ?? null) : null,
      history: (row.history ?? []).map((point) => ({
        date: point.date,
        authorityRankProxy: scaleOpenPageRank(point.open_page_rank),
      })),
    });
  }
  return out;
}

/**
 * Ahrefs' keyless public Domain Rating, 0-100. The last-resort authority
 * source: it needs no account at all, so a brand-new install still shows a
 * real number for any domain.
 */
export async function fetchAhrefsDomainRating(input: {
  domain: string;
  fetchImpl?: typeof fetch;
}): Promise<number | null> {
  const doFetch = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(
      `${AHREFS_DR_ENDPOINT}?target=${encodeURIComponent(input.domain)}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const parsed = ahrefsResponseSchema.safeParse(await response.json());
  if (!parsed.success) return null;

  // Ahrefs answers 200 with DR 0 for domains it has no rating for, so 0 here
  // is "unrated", not "worthless". Mirrors src/serverFunctions/ahrefs.ts.
  const rating = parsed.data.domain_rating.domain_rating;
  return rating > 0 ? rating : null;
}

/**
 * Real inbound links, with anchor text, for one page of a site verified in
 * this Bing Webmaster account.
 *
 * Returns null when Bing refuses the site, which is the normal answer for any
 * domain the account has not verified. Null must reach the user as "not
 * available for a site you do not own", never as an empty backlink profile.
 */
export async function fetchBingInboundLinks(input: {
  apiKey: string;
  siteUrl: string;
  pageUrl: string;
  maxPages?: number;
  fetchImpl?: typeof fetch;
}): Promise<InboundLink[] | null> {
  const doFetch = input.fetchImpl ?? fetch;
  const maxPages = Math.max(1, input.maxPages ?? DEFAULT_BING_LINK_PAGES);
  const links: InboundLink[] = [];

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${BING_JSON_BASE}/GetUrlLinks`);
    url.searchParams.set("apikey", input.apiKey);
    url.searchParams.set("siteUrl", input.siteUrl);
    url.searchParams.set("link", input.pageUrl);
    url.searchParams.set("page", String(page));

    let response: Response;
    try {
      response = await doFetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // A partial read is still real data; only a first-page failure is
      // "we could not ask".
      return page === 0 ? null : links;
    }
    // The key travels in the query string, so nothing here may echo the URL.
    if (!response.ok) return page === 0 ? null : links;

    const payload: unknown = await response.json();
    const parsed = parseBingLinkDetails(payload, input.pageUrl);
    links.push(...parsed.links);
    if (parsed.totalPages !== null && page + 1 >= parsed.totalPages) break;
    if (parsed.links.length === 0) break;
  }

  return links;
}

/**
 * Bing's `GetLinkCounts` payload: the pages of a verified site that have
 * inbound links, plus how many each has.
 *
 * Takes the UNWRAPPED `d` payload (what provider.ownSiteLinkCounts returns) as
 * `unknown`, because Microsoft documents it as
 * `{"Links":[{"Url":..,"Count":..}],"TotalPages":n}` while free-seo/bing.ts
 * types the same value as a flat array of `{Url, LinkCount}`. Accepting both
 * keeps this correct whichever shape actually arrives.
 */
export function parseBingLinkCounts(payload: unknown): SiteInboundPages {
  const record = isRecord(payload) ? payload : null;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.Links)
      ? record.Links
      : [];
  const totalPages =
    typeof record?.TotalPages === "number" ? record.TotalPages : null;

  const pages: SiteInboundPages["pages"] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const url = typeof row.Url === "string" ? row.Url : null;
    const count =
      typeof row.Count === "number"
        ? row.Count
        : typeof row.LinkCount === "number"
          ? row.LinkCount
          : null;
    if (url === null || count === null) continue;
    pages.push({ url, inboundLinks: count });
  }

  return {
    pages,
    // Unknown page count means we cannot prove we hold everything, so treat
    // the list as partial. Under-claiming beats publishing a short sum as a
    // site total.
    complete: totalPages !== null && totalPages <= 1,
  };
}

function parseBingLinkDetails(
  payload: unknown,
  urlTo: string,
): { links: InboundLink[]; totalPages: number | null } {
  const record = isRecord(payload) && isRecord(payload.d) ? payload.d : null;
  const rows = Array.isArray(record?.Details) ? record.Details : [];
  const totalPages =
    typeof record?.TotalPages === "number" ? record.TotalPages : null;

  const links: InboundLink[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    if (typeof row.Url !== "string" || row.Url === "") continue;
    links.push({
      urlFrom: row.Url,
      urlTo,
      anchor:
        typeof row.AnchorText === "string" && row.AnchorText !== ""
          ? row.AnchorText
          : null,
    });
  }
  return { links, totalPages };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
