/**
 * PageSpeed Insights — free Lighthouse, run by Google's own infrastructure.
 *
 * This replaces the paid Lighthouse endpoint. PSI runs the same Lighthouse
 * engine and returns the same category scores and Core Web Vitals, so the
 * fidelity loss versus the paid path is essentially nil for what the audit
 * displays.
 *
 * ⚠️ AN API KEY IS EFFECTIVELY REQUIRED, despite PSI being documented as
 * usable without one. Measured 2026-08-16: an unauthenticated call returned
 * HTTP 429 `RESOURCE_EXHAUSTED`, "Quota exceeded for quota metric 'Queries'
 * ... for consumer 'project_number:583797351490'" — the shared anonymous
 * project, whose quota strangers exhaust daily. A free Google Cloud API key
 * moves you onto your own quota (25,000 requests/day) and needs no billing
 * account, no card and no approval.
 *
 * ⚠️ SLOW BY NATURE. Google actually loads and renders the page, so 10-30s per
 * URL per strategy is normal. Callers must not run these in a tight loop.
 */

const PSI_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/** Google renders the page; a short timeout just guarantees failure. */
const PSI_TIMEOUT_MS = 120_000;

interface PageSpeedScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  cls: number | null;
  /** PSI reports Total Blocking Time in lab data; INP is field-only. */
  inpMs: number | null;
  ttfbMs: number | null;
}

class PageSpeedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PageSpeedError";
  }
}

interface PageSpeedClientOptions {
  /** Free Google Cloud API key. Without it you share an exhausted quota. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createPageSpeedClient(options: PageSpeedClientOptions = {}) {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? PSI_TIMEOUT_MS;

  return {
    async analyse(input: {
      url: string;
      strategy: "mobile" | "desktop";
    }): Promise<{ scores: PageSpeedScores; payload: unknown }> {
      const endpoint = new URL(PSI_ENDPOINT);
      endpoint.searchParams.set("url", input.url);
      endpoint.searchParams.set("strategy", input.strategy);
      // Ask for every category explicitly; PSI returns performance only by
      // default, which would silently null the other three scores.
      for (const category of [
        "performance",
        "accessibility",
        "best-practices",
        "seo",
      ]) {
        endpoint.searchParams.append("category", category);
      }
      if (options.apiKey) endpoint.searchParams.set("key", options.apiKey);

      const response = await doFetch(endpoint.toString(), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        // 429 without a key is the shared-quota case, and the fix is specific
        // enough to be worth naming here rather than in a generic handler.
        const hint =
          response.status === 429 && !options.apiKey
            ? " Add a free Google API key (PAGESPEED_API_KEY): unauthenticated calls share a quota that is routinely exhausted."
            : "";
        throw new PageSpeedError(
          `PageSpeed Insights failed with HTTP ${response.status}.${hint}`,
          response.status,
        );
      }

      const payload: unknown = await response.json();
      return { scores: extractScores(payload), payload };
    },
  };
}

/** Reads the fields the audit displays, tolerating any absent audit. */
export function extractScores(payload: unknown): PageSpeedScores {
  const lighthouse = pick(payload, "lighthouseResult");
  const categories = pick(lighthouse, "categories");
  const audits = pick(lighthouse, "audits");

  return {
    performance: score(categories, "performance"),
    accessibility: score(categories, "accessibility"),
    bestPractices: score(categories, "best-practices"),
    seo: score(categories, "seo"),
    lcpMs: numericValue(audits, "largest-contentful-paint"),
    cls: numericValue(audits, "cumulative-layout-shift"),
    // Lab runs cannot measure INP (it needs real interaction), so PSI reports
    // Total Blocking Time instead. Using TBT here and labelling it INP would
    // be wrong, so this stays null unless the field data carries it.
    inpMs: null,
    ttfbMs: numericValue(audits, "server-response-time"),
  };
}

function pick(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

/** PSI scores are 0-1; the app stores 0-100. */
function score(categories: unknown, name: string): number | null {
  const raw = pick(pick(categories, name), "score");
  return typeof raw === "number" ? Math.round(raw * 100) : null;
}

function numericValue(audits: unknown, name: string): number | null {
  const raw = pick(pick(audits, name), "numericValue");
  return typeof raw === "number" ? raw : null;
}
