/**
 * Bright Data SERP API — live Google positions for ANY domain.
 *
 * ⚠️⚠️ READ THIS BEFORE TOUCHING ANYTHING HERE. This is the ONE source in the
 * stack that is not licensed by the search engine it reads. It is opt-in per
 * organization, off by default, and the owner enabled it knowing the exposure
 * below. Do not promote it to a default, and do not blend its numbers into
 * anything presented as first-party data.
 *
 * WHAT IT BUYS: the only answer to "where does competitor.com rank for keyword
 * X on Google". Every free licensed source can report positions for domains you
 * have verified (Search Console, Bing Webmaster) and nothing more. This closes
 * that gap, and with it the two features that depend on it: SERP analysis and
 * keyword difficulty, which needs the ranking domains as its input.
 *
 * THE EXPOSURE, stated plainly because it is not the vendor's:
 *   - Bright Data's MSA §8 makes the CLIENT defend Bright Data against claims
 *     arising from the client's use. §3 makes the client "solely responsible".
 *     The indemnity runs toward us, not away.
 *   - Google's ToS bars automated access "through the use of any automated
 *     means (such as robots, spiders or scrapers)". Bright Data scrapes Google
 *     and does not claim otherwise; Google sells no sanctioned SERP API.
 *   - The category is in active litigation (Google v. SerpApi; Reddit v.
 *     SerpApi/Perplexity/Oxylabs). Bright Data is named in neither, and the
 *     DMCA claims were dismissed in July 2026, so it is contested rather than
 *     settled.
 *
 * FREE TIER: 5,000 records/month, recurring, no card. Enough for a
 * monthly cadence over a normal competitor set, not enough for daily tracking.
 *
 * PROVENANCE IS MANDATORY. Every row carries `source: "brightdata"` so callers
 * can label it. A position from here is a scraped observation, not a licensed
 * measurement, and the UI must never present the two as the same thing.
 */

const DIRECT_API = "https://api.brightdata.com/request";

/** Google renders and the proxy retries; a short timeout guarantees failure. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * What a standard SERP API zone actually returns. Bright Data's own console
 * says "SERP API supports up to 10 results. Need 100?" and points at the
 * separate Google SERP Scraper zone for 1-100. Requesting more than the zone
 * supports truncates silently, so the default matches the common zone.
 */
const SERP_API_DEFAULT_RESULTS = 10;

interface BrightDataCredentials {
  /** API token from the Bright Data dashboard. */
  apiToken: string;
  /** Zone name configured as a SERP zone. */
  zone: string;
}

interface SerpPosition {
  /** 1-based rank on the page requested. */
  position: number;
  url: string;
  domain: string;
  title: string | null;
  /** Always "brightdata" so callers cannot forget where this came from. */
  source: "brightdata";
}

class BrightDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BrightDataError";
  }
}

interface BrightDataClientOptions {
  credentials: BrightDataCredentials;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createBrightDataClient(options: BrightDataClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const { credentials } = options;

  return {
    /**
     * Organic results for one query. `gl` and `hl` are Google's own country and
     * interface-language parameters, so our market table maps straight onto
     * them without a second registry.
     */
    async search(input: {
      query: string;
      gl?: string;
      hl?: string;
      /**
       * Results to request. The plain SERP API zone caps at 10; only the
       * "Google SERP Scraper" zone type returns 1-100 in one call. Asking for
       * more than a zone supports does not error, it silently truncates, so a
       * competitor at position 11+ reads as "not ranking" when it is really
       * "outside the window we asked for".
       */
      num?: number;
    }): Promise<SerpPosition[]> {
      const target = new URL("https://www.google.com/search");
      target.searchParams.set("q", input.query);
      if (input.gl) target.searchParams.set("gl", input.gl);
      if (input.hl) target.searchParams.set("hl", input.hl);
      // Default to the plain SERP API zone's real ceiling rather than an
      // optimistic 100 that most zones cannot honour.
      target.searchParams.set(
        "num",
        String(Math.min(input.num ?? SERP_API_DEFAULT_RESULTS, 100)),
      );
      // Bright Data's own flag: return parsed JSON instead of raw HTML, which
      // saves us maintaining a Google DOM scraper that breaks on every redesign.
      target.searchParams.set("brd_json", "1");

      const response = await doFetch(DIRECT_API, {
        method: "POST",
        headers: {
          authorization: `Bearer ${credentials.apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          zone: credentials.zone,
          url: target.toString(),
          format: "raw",
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        // The token is a header, so the body is safe to omit from the error.
        throw new BrightDataError(
          `Bright Data SERP request failed with HTTP ${response.status}`,
          response.status,
        );
      }

      const payload: unknown = await response.json();
      return parseOrganic(payload);
    },
  };
}

/**
 * Reads the organic block out of Bright Data's parsed response.
 *
 * Deliberately tolerant: this is a scraped payload whose shape can change
 * without notice, so a missing field drops that row rather than throwing and
 * losing the whole SERP.
 */
export function parseOrganic(payload: unknown): SerpPosition[] {
  const organic = pick(payload, "organic");
  if (!Array.isArray(organic)) return [];

  const rows: SerpPosition[] = [];
  organic.forEach((entry, index) => {
    const link = str(pick(entry, "link")) ?? str(pick(entry, "url"));
    if (!link) return;
    let domain: string;
    try {
      domain = new URL(link).hostname.replace(/^www\./, "");
    } catch {
      return;
    }
    const rank = num(pick(entry, "rank")) ?? num(pick(entry, "position"));
    rows.push({
      // Fall back to array order when Google omits an explicit rank.
      position: rank ?? index + 1,
      url: link,
      domain,
      title: str(pick(entry, "title")),
      source: "brightdata",
    });
  });
  return rows;
}

/** Where a domain sits in a result set, or null when it does not appear. */
export function positionOf(
  rows: SerpPosition[],
  domain: string,
): number | null {
  const target = domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  const hit = rows.find(
    (row) => row.domain === target || row.domain.endsWith(`.${target}`),
  );
  // Null, not 0 and not 101: "not in the results we fetched" is not a rank.
  return hit ? hit.position : null;
}

function pick(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Parses the JSON blob stored as the encrypted secret. */
export function parseBrightDataCredentials(
  secret: string,
  zone: string | null,
): BrightDataCredentials | null {
  const apiToken = secret.trim();
  const zoneName = (zone ?? "").trim();
  if (!apiToken || !zoneName) return null;
  return { apiToken, zone: zoneName };
}
