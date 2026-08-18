/**
 * Microsoft Advertising Ad Insight API — real search volume, real CPC, and
 * competitor keyword discovery, free and available TODAY.
 *
 * WHY THIS IS THE PRIMARY SOURCE, not Google Ads. Google Ads API Basic Access
 * is granted by manual review and is routinely refused to small startups and
 * new brands, so building on it as the default would leave most installs with
 * nothing. Microsoft's developer token is self-service: sign in as Super Admin
 * and press "Request Token". Their own docs say "Any Microsoft Advertising
 * user with a developer token can begin using the Bing Ads API." There is no
 * access tier, no review, and no ad-spend requirement. Google Ads stays wired
 * as an optional upgrade for the minority who do get approved.
 *
 * WHAT IT RETURNS, per keyword:
 *   MonthlySearchCounts  12 months of real search volume, newest first
 *   SuggestedBid         the actual CPC, in account currency
 *   Competition          LOW / MEDIUM / HIGH
 *
 * Seeds: a keyword list (QuerySearchParameter) or a URL (UrlSearchParameter).
 * The URL seed is how we discover what a COMPETITOR's page targets, using
 * Microsoft's own keyword-association model.
 *
 * ⚠️ THIS IS MICROSOFT/BING DEMAND, NOT GOOGLE. It is real, measured volume
 * with a real bid attached, which makes it far stronger than an impressions
 * proxy, but it is not Google's number. Anything rendering these values must
 * say which engine they came from. Bing's share is smaller, so absolute
 * volumes run below Google's while the ORDERING between keywords holds, and
 * ordering is what keyword research actually needs.
 *
 * ⚠️ REST, NOT SOAP. Most of this API is SOAP, which would be miserable in
 * workerd. The Ad Insight service also publishes a JSON interface at
 * /AdInsight/v13/KeywordIdeas/Query, which is what this client speaks.
 */

const PRODUCTION_BASE = "https://adinsight.api.bingads.microsoft.com";
const SANDBOX_BASE = "https://adinsight.api.sandbox.bingads.microsoft.com";

/**
 * Published in Microsoft's own docs as the universal sandbox token: "Everyone
 * can use the universal sandbox developer token i.e., BBD37VB98." Useful for
 * wiring the integration before an account exists. It reaches sandbox data
 * only, never production numbers.
 */
const _SANDBOX_DEVELOPER_TOKEN = "BBD37VB98";

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Microsoft's token endpoint. `common` rather than a tenant id because the
 * Advertising sign-in is usually a personal Microsoft account, which a
 * tenant-scoped endpoint rejects.
 */
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

interface MicrosoftAdsCredentials {
  developerToken: string;
  /**
   * OAuth access token. Optional, and on its own it buys about an hour:
   * Microsoft expires these fast, so a stored one is a connection that works
   * during setup and is dead by the next run. Supply `refreshToken` and
   * `clientId` to have a live one minted per call, the way google-ads.ts does.
   */
  accessToken?: string;
  /** Long-lived. With `clientId`, this is what keeps the connection alive. */
  refreshToken?: string;
  /** Application id from the Entra app registration. */
  clientId?: string;
  customerId: string;
  customerAccountId: string;
  sandbox?: boolean;
}

/**
 * Exchange the refresh token for an access token.
 *
 * Falls back to a stored access token so an existing static-token connection
 * keeps working until it expires, rather than breaking the moment this ships.
 */
async function resolveAccessToken(
  credentials: MicrosoftAdsCredentials,
  fetchImpl: typeof fetch,
): Promise<string> {
  if (!credentials.refreshToken || !credentials.clientId) {
    if (credentials.accessToken) return credentials.accessToken;
    throw new Error(
      "Microsoft Advertising has no usable credential: supply refreshToken and clientId, or an accessToken.",
    );
  }
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
      scope: "https://ads.microsoft.com/msads.manage offline_access",
    }),
  });
  if (!response.ok) {
    // Body omitted: it echoes the refresh token back in some error shapes.
    throw new Error(
      `Microsoft Advertising token refresh failed: HTTP ${response.status}`,
    );
  }
  const parsed: unknown = await response.json();
  const token =
    parsed !== null &&
    typeof parsed === "object" &&
    "access_token" in parsed &&
    typeof parsed.access_token === "string"
      ? parsed.access_token
      : null;
  if (!token)
    throw new Error("Microsoft Advertising returned no access token.");
  return token;
}

export interface MicrosoftAdsKeyword {
  keyword: string;
  /** Most recent month's searches, or null when Microsoft reported none. */
  searchVolume: number | null;
  /** Newest first, as Microsoft returns it. */
  monthlySearchCounts: number[];
  /** Suggested bid in account currency. This is the CPC. */
  suggestedBid: number | null;
  /** 0-1, derived from Microsoft's LOW / MEDIUM / HIGH. */
  competition: number | null;
}

class MicrosoftAdsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MicrosoftAdsError";
  }
}

interface MicrosoftAdsClientOptions {
  credentials: MicrosoftAdsCredentials;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createMicrosoftAdsClient(options: MicrosoftAdsClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const { credentials } = options;
  const base = credentials.sandbox ? SANDBOX_BASE : PRODUCTION_BASE;

  return {
    /**
     * Keyword ideas with volume, CPC and competition.
     *
     * `url` seeds a competitor page or site. Exactly one of `keywords` or
     * `url` is required; Microsoft rejects a request carrying neither.
     */
    async keywordIdeas(input: {
      keywords?: string[];
      url?: string;
      /** Microsoft geographical location id. Country level is right here. */
      locationId?: number;
      /** Language name as Microsoft spells it, e.g. "English". */
      language?: string;
      /** False returns attributes for exactly the keywords given. */
      expandIdeas?: boolean;
      limit?: number;
    }): Promise<MicrosoftAdsKeyword[]> {
      // `SearchParameter` is an abstract base with 15 derived types, and the
      // REST interface carries the concrete type in a `Type` property. Without
      // it the service cannot deserialize the request and answers 400, so every
      // call from this client failed before it reached the API. The operation
      // page's own "Request JSON" sample omits `Type` because it is generated
      // by flattening all derived types into one union; the per-type reference
      // pages each show it explicitly and are the authoritative form.
      const searchParameters: Record<string, unknown>[] = [];

      if (input.url) {
        searchParameters.push({ Type: "UrlSearchParameter", Url: input.url });
      }
      if (input.keywords?.length) {
        searchParameters.push({
          Type: "QuerySearchParameter",
          Queries: input.keywords,
        });
      }
      if (!searchParameters.length) {
        throw new MicrosoftAdsError("A keyword or url seed is required", 400);
      }

      // Language, Location and Network are all mandatory per the reference;
      // omitting any one of them fails the whole request. The nested Criterion
      // objects are left without their own `Type`: the parent reference pages
      // render them bare, and the per-criterion pages disagree with each other,
      // so following the parent form is the defensible reading.
      searchParameters.push({
        Type: "LanguageSearchParameter",
        Languages: [{ Language: input.language ?? "English" }],
      });
      searchParameters.push({
        Type: "LocationSearchParameter",
        Locations: [{ LocationId: input.locationId ?? DEFAULT_LOCATION_ID }],
      });
      searchParameters.push({
        Type: "NetworkSearchParameter",
        Network: { Network: "OwnedAndOperatedAndSyndicatedSearch" },
      });

      // Minted per call rather than per client, so a long-lived provider does
      // not hold a token past its hour.
      const accessToken = await resolveAccessToken(credentials, doFetch);

      const response = await doFetch(
        `${base}/AdInsight/v13/KeywordIdeas/Query`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            DeveloperToken: credentials.developerToken,
            CustomerId: credentials.customerId,
            CustomerAccountId: credentials.customerAccountId,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ExpandIdeas: input.expandIdeas ?? true,
            // Competition is required by the API even when unused downstream.
            IdeaAttributes: [
              "Keyword",
              "Competition",
              "MonthlySearchCounts",
              "SuggestedBid",
            ],
            SearchParameters: searchParameters,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok) {
        // Credentials travel in headers, so the body is safe to omit entirely.
        throw new MicrosoftAdsError(
          `Microsoft Ads keyword ideas failed with HTTP ${response.status}`,
          response.status,
        );
      }

      const body: { KeywordIdeas?: RawIdea[] } = await response.json();
      const rows = (body.KeywordIdeas ?? []).map(toKeyword);
      return input.limit ? rows.slice(0, input.limit) : rows;
    },
  };
}

/** United States. Callers pass a real market id from markets.ts. */
const DEFAULT_LOCATION_ID = 190;

interface RawIdea {
  Keyword?: string;
  MonthlySearchCounts?: Array<number | string>;
  SuggestedBid?: number | string | null;
  Competition?: string | null;
}

/**
 * Microsoft grades competition as a word, not a number. Mapping to the 0-1
 * scale the app already uses keeps one competition semantic across providers;
 * an unrecognised value stays null rather than defaulting to zero, which would
 * read as "nobody is bidding on this".
 */
const COMPETITION_SCALE: Record<string, number> = {
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.85,
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toKeyword(idea: RawIdea): MicrosoftAdsKeyword {
  const monthly = (idea.MonthlySearchCounts ?? [])
    .map(toNumber)
    .filter((n): n is number => n !== null);

  return {
    keyword: idea.Keyword ?? "",
    // Microsoft returns newest first, so the current volume is index 0.
    searchVolume: monthly.length > 0 ? monthly[0] : null,
    monthlySearchCounts: monthly,
    suggestedBid: toNumber(idea.SuggestedBid),
    competition:
      idea.Competition && idea.Competition.toUpperCase() in COMPETITION_SCALE
        ? COMPETITION_SCALE[idea.Competition.toUpperCase()]
        : null,
  };
}

/**
 * Parses the JSON blob stored as the encrypted secret. Like Google Ads, this
 * provider needs several secret values, so they travel together.
 */
export function parseMicrosoftAdsCredentials(
  secret: string,
  publicIdentifier: string | null,
): MicrosoftAdsCredentials | null {
  try {
    const parsed: unknown = JSON.parse(secret);
    if (typeof parsed !== "object" || parsed === null) return null;
    const field = (name: string): string => {
      const value: unknown = Reflect.get(parsed, name);
      return typeof value === "string" ? value : "";
    };
    const developerToken = field("developerToken");
    const accessToken = field("accessToken");
    const refreshToken = field("refreshToken");
    const clientId = field("clientId");
    // "customerId|accountId", both digits, as the Settings field explains.
    const [customerId = "", customerAccountId = ""] = (publicIdentifier ?? "")
      .split("|")
      .map((part) => part.replace(/\D/g, ""));

    // Either credential style is valid: a refresh pair, which keeps working,
    // or a bare access token, which expires within the hour.
    const hasRefreshPair = Boolean(refreshToken && clientId);
    if (
      !developerToken ||
      (!hasRefreshPair && !accessToken) ||
      !customerId ||
      !customerAccountId
    ) {
      return null;
    }
    return {
      developerToken,
      ...(accessToken ? { accessToken } : {}),
      ...(hasRefreshPair ? { refreshToken, clientId } : {}),
      customerId,
      customerAccountId,
    };
  } catch {
    return null;
  }
}
