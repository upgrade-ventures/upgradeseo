/**
 * Google Ads API client — REAL Google search volume, CPC and competition, free.
 *
 * This is the strongest free source in the stack and it replaces the paid
 * keyword data outright. Google charges nothing per call: the API is free to
 * use, and a Google Ads manager account can be created without a card and
 * without running a campaign. What it costs is an approval wait for a
 * developer token, not money.
 *
 * WHY IT BEATS THE BING PATH: Bing gives Bing impressions, which are a
 * directional proxy. This gives Google's own `avg_monthly_searches`, twelve
 * months of `monthly_search_volumes`, `competition_index`, and top-of-page bid
 * ranges, which is the actual CPC. Where both are configured, this wins.
 *
 * ⚠️ HONEST LIMIT — VOLUME BUCKETING. Without active ad spend, Google returns
 * `avg_monthly_searches` rounded into coarse buckets rather than its full
 * resolution. The ordering between keywords stays correct, which is what
 * keyword research needs. Do not present these as exact demand.
 *
 * ⚠️ REST, NOT gRPC. The official client libraries are Node/gRPC and cannot
 * run in workerd. Everything here is plain fetch against the REST surface,
 * which is why the version constant matters.
 *
 * VERSION: v25 is the newest live version (v26 and v27 return 404; v22 to v25
 * all return 401 UNAUTHENTICATED, i.e. alive and asking for credentials).
 * Measured 2026-08-16.
 */

const API_VERSION = "v25";
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Google returns money as micros: 1,000,000 micros = one unit of currency. */
const MICROS_PER_UNIT = 1_000_000;

const REQUEST_TIMEOUT_MS = 30_000;

interface GoogleAdsCredentials {
  /** The 22-character token from the Ads API Center. */
  developerToken: string;
  clientId: string;
  clientSecret: string;
  /** Long-lived refresh token minted once via the OAuth consent flow. */
  refreshToken: string;
  /** Manager (MCC) customer id, digits only, no dashes. */
  customerId: string;
}

export interface GoogleAdsKeyword {
  keyword: string;
  /** Google's average monthly searches. Bucketed without ad spend. */
  avgMonthlySearches: number | null;
  /** 0-100. Null when Google reports none. */
  competitionIndex: number | null;
  /** Top-of-page bid low estimate, in currency units (not micros). */
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  /** Twelve months of history, newest last. */
  monthlySearches: Array<{ year: number; month: number; searchVolume: number }>;
}

class GoogleAdsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleAdsError";
  }
}

interface GoogleAdsClientOptions {
  credentials: GoogleAdsCredentials;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createGoogleAdsClient(options: GoogleAdsClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const { credentials } = options;

  /**
   * Exchanges the refresh token for an access token. Cached per client
   * instance only: tokens live an hour and a request-scoped client is cheap,
   * so a longer-lived cache would just be a place for a stale token to hide.
   */
  let accessTokenPromise: Promise<string> | null = null;

  async function accessToken(): Promise<string> {
    accessTokenPromise ??= (async () => {
      const body = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      });
      const response = await doFetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        // Never echo the body: it can contain the client secret back to us.
        throw new GoogleAdsError(
          `Google OAuth token exchange failed with HTTP ${response.status}`,
          response.status,
        );
      }
      const json: { access_token?: string } = await response.json();
      if (!json.access_token) {
        throw new GoogleAdsError("Google OAuth returned no access token", 500);
      }
      return json.access_token;
    })();
    return accessTokenPromise;
  }

  async function call<T>(method: string, payload: unknown): Promise<T> {
    const token = await accessToken();
    const response = await doFetch(
      `${API_BASE}/customers/${credentials.customerId}:${method}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "developer-token": credentials.developerToken,
          // Required whenever the calling account is a manager account.
          "login-customer-id": credentials.customerId,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    if (!response.ok) {
      throw new GoogleAdsError(
        `Google Ads ${method} failed with HTTP ${response.status}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }

  return {
    /**
     * Keyword ideas from a seed. `url` seeds a COMPETITOR page or site, which
     * is how we discover what Google associates with a rival's content.
     */
    async keywordIdeas(input: {
      keywords?: string[];
      url?: string;
      geoTargetConstant?: string;
      languageConstant?: string;
      limit?: number;
    }): Promise<GoogleAdsKeyword[]> {
      const payload: Record<string, unknown> = {
        includeAdultKeywords: false,
        // Google returns partitioned buckets; MOBILE+DESKTOP totals are what
        // a keyword tool should show.
        keywordPlanNetwork: "GOOGLE_SEARCH",
      };

      // Exactly one seed type may be set, and which one changes the field name.
      if (input.keywords?.length && input.url) {
        payload.keywordAndUrlSeed = {
          url: input.url,
          keywords: input.keywords,
        };
      } else if (input.url) {
        payload.urlSeed = { url: input.url };
      } else if (input.keywords?.length) {
        payload.keywordSeed = { keywords: input.keywords };
      } else {
        throw new GoogleAdsError("A keyword or url seed is required", 400);
      }

      if (input.geoTargetConstant) {
        payload.geoTargetConstants = [input.geoTargetConstant];
      }
      if (input.languageConstant) payload.language = input.languageConstant;

      const json = await call<{ results?: RawIdea[] }>(
        "generateKeywordIdeas",
        payload,
      );
      const rows = (json.results ?? []).map(toKeyword);
      return input.limit ? rows.slice(0, input.limit) : rows;
    },

    /** Metrics for a known keyword list. Cheaper than ideas for refreshes. */
    async historicalMetrics(input: {
      keywords: string[];
      geoTargetConstant?: string;
      languageConstant?: string;
    }): Promise<GoogleAdsKeyword[]> {
      const payload: Record<string, unknown> = { keywords: input.keywords };
      if (input.geoTargetConstant) {
        payload.geoTargetConstants = [input.geoTargetConstant];
      }
      if (input.languageConstant) payload.language = input.languageConstant;

      const json = await call<{ results?: RawHistorical[] }>(
        "generateKeywordHistoricalMetrics",
        payload,
      );
      return (json.results ?? []).map((row) =>
        toKeyword({ text: row.text, keywordIdeaMetrics: row.keywordMetrics }),
      );
    },
  };
}

interface RawMetrics {
  avgMonthlySearches?: string | number;
  competitionIndex?: string | number;
  lowTopOfPageBidMicros?: string | number;
  highTopOfPageBidMicros?: string | number;
  monthlySearchVolumes?: Array<{
    year?: string | number;
    month?: string;
    monthlySearches?: string | number;
  }>;
}
interface RawIdea {
  text?: string;
  keywordIdeaMetrics?: RawMetrics;
}
interface RawHistorical {
  text?: string;
  keywordMetrics?: RawMetrics;
}

/** Google sends 64-bit fields as JSON strings; coerce before arithmetic. */
function num(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function micros(value: string | number | undefined): number | null {
  const n = num(value);
  return n === null ? null : n / MICROS_PER_UNIT;
}

/** Month arrives as an enum name ("JANUARY"), not a number. */
const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

export function monthNumber(name: string | undefined): number {
  if (!name) return 0;
  const index = MONTHS.indexOf(name.toUpperCase());
  return index === -1 ? 0 : index + 1;
}

function toKeyword(idea: RawIdea): GoogleAdsKeyword {
  const m = idea.keywordIdeaMetrics ?? {};
  return {
    keyword: idea.text ?? "",
    avgMonthlySearches: num(m.avgMonthlySearches),
    competitionIndex: num(m.competitionIndex),
    lowTopOfPageBid: micros(m.lowTopOfPageBidMicros),
    highTopOfPageBid: micros(m.highTopOfPageBidMicros),
    monthlySearches: (m.monthlySearchVolumes ?? []).map((entry) => ({
      year: num(entry.year) ?? 0,
      month: monthNumber(entry.month),
      searchVolume: num(entry.monthlySearches) ?? 0,
    })),
  };
}

/**
 * Parses the JSON blob we store as the encrypted secret. Google Ads needs five
 * values and the provider-key store holds one secret plus one public field, so
 * the four secret parts travel together as JSON inside the encrypted column.
 */
export function parseGoogleAdsCredentials(
  secret: string,
  customerId: string | null,
): GoogleAdsCredentials | null {
  try {
    const parsed: unknown = JSON.parse(secret);
    if (typeof parsed !== "object" || parsed === null) return null;
    // Read each field off `unknown` with its own guard rather than asserting
    // the whole object into a shape it may not have.
    const field = (name: string): string => {
      const value: unknown = Reflect.get(parsed, name);
      return typeof value === "string" ? value : "";
    };
    const developerToken = field("developerToken");
    const clientId = field("clientId");
    const clientSecret = field("clientSecret");
    const refreshToken = field("refreshToken");
    // Digits only: users paste manager ids with dashes constantly.
    const resolvedCustomerId = (customerId ?? "").replace(/\D/g, "");
    if (
      !developerToken ||
      !clientId ||
      !clientSecret ||
      !refreshToken ||
      !resolvedCustomerId
    ) {
      return null;
    }
    return {
      developerToken,
      clientId,
      clientSecret,
      refreshToken,
      customerId: resolvedCustomerId,
    };
  } catch {
    return null;
  }
}
