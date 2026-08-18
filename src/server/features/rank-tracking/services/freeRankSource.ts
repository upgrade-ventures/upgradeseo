/**
 * Free rank tracking and the honest ceiling of what it can report.
 *
 * THE CONSTRAINT, stated once so nothing downstream is designed against a
 * fantasy: no free licensed source returns a Google ranking for an arbitrary
 * keyword and an arbitrary domain. Scraping Google is not a source. So this
 * module builds the maximum that IS achievable and refuses to guess the rest:
 *
 *   1. GOOGLE SEARCH CONSOLE, for a domain covered by the project's connected
 *      property. `searchanalytics.query` over query + page + device returns a
 *      real Google position, free and unlimited. It is an AVERAGE OVER A DATE
 *      WINDOW, not a live SERP check, and every name here says so.
 *   2. BING WEBMASTER `GetQueryStats`, for a site verified in Bing when there
 *      is no Google OAuth. Real position data, zero friction, but it is BING
 *      position and is labelled Bing everywhere it surfaces.
 *   3. Domains the user has NOT verified: nothing exists. The caller gets an
 *      explicit unavailable with the reason, never a zero and never a guess.
 *
 * Two consequences that callers must not smooth over:
 *   - A keyword absent from the window is NOT written as "not ranking". Search
 *     Console omits rare and anonymised queries, so absence is missing data,
 *     not a position. Absent keywords are skipped, so the previous snapshot
 *     stays visible instead of being overwritten with a false zero-visibility
 *     reading.
 *   - Bing reports one average impression position per query with no device
 *     split, so a Bing check cannot distinguish desktop from mobile.
 */

import { AppError } from "@/server/lib/errors";
import { createFreeSeoProvider } from "@/server/lib/free-seo/provider";
import { gscCountryFor, marketFor } from "@/server/lib/free-seo/markets";
import { tryBrightDataPositions } from "@/server/features/rank-tracking/services/brightDataRankSource";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type {
  GscDateRange,
  GscPerformanceFilter,
} from "@/server/features/gsc/searchAnalytics";

/** The window every free position is averaged over. */
const FREE_RANK_WINDOW: GscDateRange = "last_28_days";
const FREE_RANK_WINDOW_LABEL = "the last 28 days";

/** Rows per Search Console call, and the number of calls we are willing to
 *  make. Rows come back clicks-first, so a keyword with impressions but no
 *  clicks can sit deep in the list; five pages covers a large site without
 *  turning one check into an unbounded crawl. */
const GSC_ROWS_PER_PAGE = 1000;
const GSC_MAX_PAGES = 5;

export type FreeRankDevice = "desktop" | "mobile";

export type FreeRankSource =
  | "gsc_average_position"
  | "bing_average_impression_position"
  // Scraped from a live Google SERP rather than read from a licensed API.
  | "brightdata_live_serp";

export type FreeRankSnapshotRow = {
  trackingKeywordId: string;
  keyword: string;
  device: FreeRankDevice;
  /**
   * The window average, rounded to fit the integer snapshot column. This is
   * NOT a live SERP rank; see the module header.
   */
  position: number;
  url: string | null;
};

export type FreeRankCheckResult = {
  source: FreeRankSource;
  /**
   * User-facing sentence naming the source and the window. Rank tracking has
   * no label column, so this rides on the run row (see RankTrackingService)
   * and must be shown wherever the positions are.
   */
  notice: string;
  rows: FreeRankSnapshotRow[];
  /** Distinct keywords the source had data for. The rest were left alone. */
  keywordsChecked: number;
};

export type TrackedKeyword = { id: string; keyword: string };

const NO_FREE_SOURCE_MESSAGE =
  "No free rank source can report this domain. Connect a Google Search Console property that covers it for real Google positions, or add a free Bing Webmaster key for Bing positions. Free sources only cover domains you have verified; positions for a domain you do not own need a paid SERP provider.";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function bareHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function hostOfUrl(url: string): string | null {
  try {
    return bareHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

/**
 * Whether the connected Search Console property actually covers the tracked
 * domain. A `sc-domain:` property covers its subdomains; a URL-prefix property
 * covers only its own host. Getting this wrong would report one site's
 * positions under another site's name.
 */
export function gscPropertyCoversDomain(
  siteUrl: string,
  domain: string,
): boolean {
  const target = bareHost(domain);
  if (!target) return false;

  const DOMAIN_PREFIX = "sc-domain:";
  if (siteUrl.startsWith(DOMAIN_PREFIX)) {
    const property = bareHost(siteUrl.slice(DOMAIN_PREFIX.length));
    return target === property || target.endsWith(`.${property}`);
  }

  return hostOfUrl(siteUrl) === target;
}

const GSC_DEVICES: Record<string, FreeRankDevice> = {
  DESKTOP: "desktop",
  MOBILE: "mobile",
};

function keyOf(keyword: string, device: FreeRankDevice): string {
  return `${keyword.trim().toLowerCase()}|${device}`;
}

type PositionEntry = { position: number; url: string | null };

/** Running impression-weighted average for one query and device. */
type PositionAccumulator = {
  weighted: number;
  weight: number;
  topUrl: string | null;
  topImpressions: number;
};

/**
 * Collapse query + page + device rows into one position per query and device.
 *
 * Search Console reports position per page, so a query answered by three pages
 * of ours arrives three times. They are combined by impression weight, which
 * is the same weighting Search Console itself uses to average a position, and
 * the page with the most impressions is kept as the ranking URL. Rows for
 * other hosts on the property are dropped: a domain property covers
 * subdomains we are not tracking here.
 */
export function aggregateGscPositions(
  rows: GscSearchAnalyticsRow[],
  domain: string,
): Map<string, PositionEntry> {
  const target = bareHost(domain);
  const totals = new Map<string, PositionAccumulator>();

  for (const row of rows) {
    const [query, page, device] = row.keys ?? [];
    if (!query || !page || !device) continue;

    const mappedDevice = GSC_DEVICES[device.toUpperCase()];
    if (!mappedDevice) continue; // TABLET has no column in the tracker
    if (hostOfUrl(page) !== target) continue;

    // Impressions weight the average. A zero-impression row carries no weight
    // but still supplies a position, so it gets a floor of 1 rather than
    // silently vanishing.
    const weight = row.impressions > 0 ? row.impressions : 1;
    const key = keyOf(query, mappedDevice);
    const entry = totals.get(key) ?? {
      weighted: 0,
      weight: 0,
      topUrl: null,
      topImpressions: -1,
    };
    entry.weighted += row.position * weight;
    entry.weight += weight;
    if (row.impressions > entry.topImpressions) {
      entry.topImpressions = row.impressions;
      entry.topUrl = page;
    }
    totals.set(key, entry);
  }

  const positions = new Map<string, PositionEntry>();
  for (const [key, entry] of totals) {
    if (entry.weight === 0) continue;
    positions.set(key, {
      position: entry.weighted / entry.weight,
      url: entry.topUrl,
    });
  }
  return positions;
}

/** Bing's average impression position per query, keyed by lowercased query. */
export function bingPositionsByQuery(
  rows: Array<{ Query: string; AvgImpressionPosition: number }>,
): Map<string, number> {
  const positions = new Map<string, number>();
  for (const row of rows) {
    if (!row.Query || !Number.isFinite(row.AvgImpressionPosition)) continue;
    positions.set(row.Query.trim().toLowerCase(), row.AvgImpressionPosition);
  }
  return positions;
}

/** Snapshot rows from a per-device position map. Keywords the source had no
 *  data for are skipped, never written as a missing position. */
export function buildSnapshotRows(input: {
  keywords: TrackedKeyword[];
  devices: FreeRankDevice[];
  positions: Map<string, PositionEntry>;
}): FreeRankSnapshotRow[] {
  const rows: FreeRankSnapshotRow[] = [];
  for (const keyword of input.keywords) {
    for (const device of input.devices) {
      const entry = input.positions.get(keyOf(keyword.keyword, device));
      if (!entry) continue;
      rows.push({
        trackingKeywordId: keyword.id,
        keyword: keyword.keyword,
        device,
        // The column is an integer, so the window average is rounded. Position
        // 1 is the floor; a rounded 0 would read as "above the first result".
        position: Math.max(1, Math.round(entry.position)),
        url: entry.url,
      });
    }
  }
  return rows;
}

/**
 * The sentence that travels with the positions. It has to name the source and
 * the window, because a window average and a live SERP check are different
 * claims, and Bing is not Google.
 */
export function freeRankNotice(input: {
  source: FreeRankSource;
  /** The verified property or domain the numbers came from. */
  subject: string;
  devices: FreeRankDevice[];
  keywordsWithoutData: number;
}): string {
  const missing =
    input.keywordsWithoutData > 0
      ? ` ${input.keywordsWithoutData} keyword(s) had no data in that window and were left unchanged: these sources omit rare and anonymised queries, so absence is not proof of not ranking.`
      : "";
  if (input.source === "gsc_average_position") {
    return `Google positions from Search Console (${input.subject}), averaged over ${FREE_RANK_WINDOW_LABEL}. An average over that window, not a live SERP check.${missing}`;
  }
  const deviceNote =
    input.devices.length > 1
      ? " Bing reports one average impression position per query with no device split, so desktop and mobile show the same Bing figure."
      : "";
  return `BING positions, not Google: average impression position for ${input.subject} from Bing Webmaster Tools, not a live SERP check.${deviceNote}${missing}`;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function buildResult(input: {
  source: FreeRankSource;
  subject: string;
  devices: FreeRankDevice[];
  keywords: TrackedKeyword[];
  positions: Map<string, PositionEntry>;
}): FreeRankCheckResult {
  const rows = buildSnapshotRows(input);
  const keywordsChecked = new Set(rows.map((row) => row.trackingKeywordId))
    .size;
  return {
    source: input.source,
    notice: freeRankNotice({
      source: input.source,
      subject: input.subject,
      devices: input.devices,
      keywordsWithoutData: input.keywords.length - keywordsChecked,
    }),
    rows,
    keywordsChecked,
  };
}

/**
 * Positions from Search Console, or null when the project has no connected
 * property covering this domain (the caller then tries Bing).
 */
async function tryGscPositions(input: {
  projectId: string;
  domain: string;
  locationCode: number;
  devices: FreeRankDevice[];
  keywords: TrackedKeyword[];
}): Promise<FreeRankCheckResult | null> {
  // Imported dynamically because the GSC service reaches the database, and the
  // pure helpers above are unit-tested without a DB binding.
  const { GscService } =
    await import("@/server/features/gsc/services/GscService");
  const connection = await GscService.getConnection(input.projectId);
  if (!connection) return null;
  if (!gscPropertyCoversDomain(connection.siteUrl, input.domain)) return null;

  const market = marketFor(input.locationCode);
  // Only filter by country when the tracked market is one we actually map. An
  // inexact match falls back to the US, and filtering on the wrong country
  // would return no rows, which reads as "not ranking anywhere".
  const filters: GscPerformanceFilter[] = [];
  if (market.exact) {
    filters.push({
      dimension: "country",
      operator: "equals",
      expression: gscCountryFor(input.locationCode),
    });
  }

  const wanted = new Set(
    input.keywords.map((keyword) => keyword.keyword.trim().toLowerCase()),
  );
  const rows: GscSearchAnalyticsRow[] = [];
  for (let page = 0; page < GSC_MAX_PAGES; page++) {
    const result = await GscService.getPerformance({
      projectId: input.projectId,
      dimensions: ["query", "page", "device"],
      dateRange: FREE_RANK_WINDOW,
      rowLimit: GSC_ROWS_PER_PAGE,
      startRow: page * GSC_ROWS_PER_PAGE,
      filters,
    });
    rows.push(...result.rows);

    // Stop as soon as the page is short (no more data) or every tracked
    // keyword has been seen; paging further would only cost subrequests.
    if (result.rows.length < GSC_ROWS_PER_PAGE) break;
    for (const row of result.rows) {
      const query = row.keys?.[0];
      if (query) wanted.delete(query.trim().toLowerCase());
    }
    if (wanted.size === 0) break;
  }

  return buildResult({
    source: "gsc_average_position",
    subject: connection.siteUrl,
    devices: input.devices,
    keywords: input.keywords,
    positions: aggregateGscPositions(rows, input.domain),
  });
}

/**
 * Positions from Bing Webmaster Tools for a site verified in the connected
 * Bing account. Throws when Bing has nothing for this domain, because the two
 * explanations (site not verified, or genuinely no impressions) are both
 * "we cannot report a position", and neither is a zero.
 */
async function tryBingPositions(input: {
  organizationId: string;
  domain: string;
  devices: FreeRankDevice[];
  keywords: TrackedKeyword[];
}): Promise<FreeRankCheckResult> {
  const { resolveProviderKey } =
    await import("@/server/features/provider-keys/providerKeys");
  const bing = await resolveProviderKey(input.organizationId, "bing");
  const free = createFreeSeoProvider({ BING_WEBMASTER_API_KEY: bing?.secret });
  if (!free.available) {
    throw new AppError("DATA_SOURCE_NOT_CONFIGURED", NO_FREE_SOURCE_MESSAGE);
  }

  let stats: Array<{ Query: string; AvgImpressionPosition: number }> = [];
  try {
    stats = await free.ownSiteQueryStats(`https://${input.domain}/`);
  } catch (error) {
    // Bing answers with an error for a site the key cannot see, which is the
    // normal outcome for a domain the user has not verified.
    console.warn("rank-tracking.free.bing-query-stats failed:", error);
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      // Not "connect Search Console": we are here either because none is
      // connected or because the connected property does not cover this domain,
      // and telling a connected user to connect it again is a dead end.
      `Bing Webmaster Tools could not read ${input.domain}. Free rank data only covers sites you have verified: verify this domain in Bing Webmaster Tools, or connect a Search Console property that covers it for Google positions.`,
    );
  }

  if (stats.length === 0) {
    throw new AppError(
      "DATA_SOURCE_NOT_CONFIGURED",
      `Bing Webmaster Tools returned no query data for ${input.domain}. Either the domain is not verified on the connected Bing account, or it had no Bing impressions in the reporting window. No position can be reported either way.`,
    );
  }

  // One Bing figure per query, repeated across the configured devices because
  // Bing does not split by device. The notice says exactly that.
  const byQuery = bingPositionsByQuery(stats);
  const positions = new Map<string, PositionEntry>();
  for (const [query, position] of byQuery) {
    for (const device of input.devices) {
      positions.set(keyOf(query, device), { position, url: null });
    }
  }

  return buildResult({
    source: "bing_average_impression_position",
    subject: input.domain,
    devices: input.devices,
    keywords: input.keywords,
    positions,
  });
}

/**
 * Free rank positions for a tracked domain, or null when the paid path should
 * run instead. Search Console first (real Google positions), Bing second (no
 * Google OAuth needed). Throws DATA_SOURCE_NOT_CONFIGURED with the reason when
 * neither can report this domain, so the user gets an explicit unavailable
 * instead of an empty table.
 */
export async function runFreeRankCheck(input: {
  projectId: string;
  organizationId: string;
  domain: string;
  locationCode: number;
  devices: "both" | "desktop" | "mobile";
  keywords: TrackedKeyword[];
}): Promise<FreeRankCheckResult | null> {
  const devices: FreeRankDevice[] =
    input.devices === "both" ? ["desktop", "mobile"] : [input.devices];
  const gsc = await tryGscPositions({
    projectId: input.projectId,
    domain: input.domain,
    locationCode: input.locationCode,
    devices,
    keywords: input.keywords,
  });
  if (gsc) return gsc;

  // `tryBingPositions` throws DATA_SOURCE_NOT_CONFIGURED when no Bing key is
  // stored. Letting that escape made the Bright Data fallback below dead code
  // for exactly the organizations that need it: Bright Data is the only source
  // that can report a domain we have not verified, so the case it exists for is
  // the case where the licensed sources are absent. The throw is held and only
  // rethrown if Bright Data also produces nothing, so the user still gets the
  // actionable "connect a source" message rather than a silent empty result.
  let bingFailure: unknown = null;
  try {
    const bing = await tryBingPositions({
      organizationId: input.organizationId,
      domain: input.domain,
      devices,
      keywords: input.keywords,
    });
    if (bing) return bing;
  } catch (error) {
    bingFailure = error;
  }

  // LAST, and only when the organization opted in. Bright Data reads a live
  // Google SERP, which is the only way to get a position for a domain we have
  // not verified, but it SCRAPES rather than reading a licensed API and the
  // vendor contract puts that exposure on us. Licensed first-party sources
  // above always win; this never runs unless they returned nothing.
  const brightData = await tryBrightDataPositions({
    organizationId: input.organizationId,
    domain: input.domain,
    locationCode: input.locationCode,
    devices,
    keywords: input.keywords,
  });
  if (brightData) return brightData;

  if (bingFailure) throw bingFailure;
  return null;
}
