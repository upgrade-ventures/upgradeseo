/**
 * Bing Webmaster Tools API client — the free replacement for the paid
 * keyword volume and suggestion endpoints.
 *
 * Why this API carries the whole free stack: `GetKeyword`, `GetKeywordStats`
 * and `GetRelatedKeywords` take a bare query string with NO siteUrl parameter.
 * Site verification is required once, to mint the key, but the keyword methods
 * then work for ANY keyword — including terms we have no relationship with.
 * That is what makes free competitor-adjacent keyword research possible at all.
 * It is free with no paid tier and no payment method at any point.
 *
 * ⚠️ ENDPOINT DEADLINE: Microsoft retires the legacy SOAP and POX
 * (`/webmaster/api.svc/pox/`) endpoints on 2026-08-31. This client speaks only
 * to `/webmaster/api.svc/json/`, which keeps the same key, quotas and
 * permissions. Do not reintroduce the POX path.
 *
 * HONEST LIMITS, so nobody reads these numbers as Google's:
 *   - Volume is BING volume, typically a single-digit percentage of Google US
 *     volume. Directionally useful for ranking keywords against each other;
 *     wrong if quoted as absolute Google demand.
 *   - Returns Impressions and BroadImpressions only. There is NO CPC and NO
 *     keyword-difficulty score. We derive a difficulty PROXY elsewhere from
 *     domain authority; it is never presented as a vendor KD score.
 *   - The backlink methods are scoped to verified sites. They cannot read a
 *     competitor's profile, and this client does not pretend otherwise.
 */

const BING_JSON_BASE = "https://ssl.bing.com/webmaster/api.svc/json";

/** Bing returns every payload wrapped in a single `d` property. */
interface BingEnvelope<T> {
  d: T;
}

interface BingKeyword {
  Query: string;
  /** Exact-match impressions for the term in the requested window. */
  Impressions: number;
  /** Impressions including broad/related variants. */
  BroadImpressions: number;
}

interface BingLinkCounts {
  Url: string;
  LinkCount: number;
}

interface BingQueryStats {
  Query: string;
  Impressions: number;
  Clicks: number;
  /** Bing reports position as a 1-based average over the window. */
  AvgImpressionPosition: number;
  AvgClickPosition: number;
}

class BingWebmasterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly method: string,
  ) {
    super(message);
    this.name = "BingWebmasterError";
  }
}

/**
 * Bing's date parameters accept ISO `YYYY-MM-DD`. We default to a trailing
 * 30-day window because the keyword methods are window-scoped: omitting dates
 * returns an error rather than a sensible default.
 */
export function defaultWindow(now: Date): {
  startDate: string;
  endDate: string;
} {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 30);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface BingClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createBingClient(options: BingClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  async function call<T>(
    method: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${BING_JSON_BASE}/${method}`);
    url.searchParams.set("apikey", options.apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }

    const response = await doFetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      // The key is in the query string, so never echo the URL into an error.
      throw new BingWebmasterError(
        `Bing Webmaster ${method} failed with HTTP ${response.status}`,
        response.status,
        method,
      );
    }

    const body: BingEnvelope<T> = await response.json();
    // Bing answers 200 with `d: null` for an unknown keyword rather than 404.
    return body.d;
  }

  return {
    /**
     * Volume for one keyword. `country`/`language` follow Bing's own codes
     * (e.g. "us" / "en-US"), not our numeric location codes — the
     * adapter is responsible for translating.
     */
    async keyword(input: {
      query: string;
      country: string;
      language: string;
      startDate: string;
      endDate: string;
    }): Promise<BingKeyword | null> {
      const rows = await call<BingKeyword[] | BingKeyword | null>(
        "GetKeyword",
        {
          q: input.query,
          country: input.country,
          language: input.language,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      );
      if (!rows) return null;
      return Array.isArray(rows) ? (rows[0] ?? null) : rows;
    },

    /** Suggestion/idea generation for a seed term. The free "ideas" source. */
    async relatedKeywords(input: {
      query: string;
      country: string;
      language: string;
      startDate: string;
      endDate: string;
    }): Promise<BingKeyword[]> {
      const rows = await call<BingKeyword[] | null>("GetRelatedKeywords", {
        q: input.query,
        country: input.country,
        language: input.language,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      return rows ?? [];
    },

    /** Historical volume points for one keyword. */
    async keywordStats(input: {
      query: string;
      country: string;
      language: string;
    }): Promise<BingKeyword[]> {
      const rows = await call<BingKeyword[] | null>("GetKeywordStats", {
        q: input.query,
        country: input.country,
        language: input.language,
      });
      return rows ?? [];
    },

    /** Inbound link counts — OWN VERIFIED SITES ONLY. */
    async linkCounts(siteUrl: string): Promise<BingLinkCounts[]> {
      const rows = await call<BingLinkCounts[] | null>("GetLinkCounts", {
        siteUrl,
        page: 0,
      });
      return rows ?? [];
    },

    /** Query performance for a verified site: impressions, clicks, position. */
    async queryStats(siteUrl: string): Promise<BingQueryStats[]> {
      const rows = await call<BingQueryStats[] | null>("GetQueryStats", {
        siteUrl,
      });
      return rows ?? [];
    },
  };
}
