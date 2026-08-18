/**
 * OpenPageRank client — free domain authority for ANY domain, including
 * competitors. 30,000 domains/month, 100 domains per request, no card.
 *
 * What this buys us, precisely: a paid keyword difficulty score is a
 * proprietary score we cannot replicate. OpenPageRank gives a 0-10 domain
 * authority for the domains ranking on a SERP, which lets us compute a
 * difficulty PROXY (see difficulty.ts) from the authority of who currently
 * ranks. That is a defensible, explainable substitute — it is NOT the paid vendor's
 * KD and is never labelled as such.
 */

/**
 * OpenPageRank moved to Keywords Everywhere: keys are now minted on
 * openpagerank.keywordseverywhere.com and the old
 * `openpagerank.com/api/v1.0/getPageRank` host answers 403 for them. The
 * request is a POST with a JSON body and a Bearer token rather than a GET with
 * repeated `domains[]` params and an `API-OPR` header.
 */
const OPR_BASE = "https://openpagerank.keywordseverywhere.com/v1/domains/bulk";

export interface DomainAuthority {
  domain: string;
  /** 0-10, OpenPageRank's decimal rank. Null when the domain is unknown. */
  pageRank: number | null;
  /** Global position; smaller is stronger. Null when unranked. */
  globalRank: number | null;
}

class OpenPageRankError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OpenPageRankError";
  }
}

interface OprClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createOpenPageRankClient(options: OprClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;

  return {
    /**
     * Authority for up to 100 domains per call. Callers pass bare hostnames
     * ("example.com"); anything with a scheme or path is normalised here so a
     * SERP result URL can be handed straight in.
     */
    async authority(domains: string[]): Promise<DomainAuthority[]> {
      const cleaned = [
        ...new Set(domains.map(normaliseDomain).filter(Boolean)),
      ];
      if (cleaned.length === 0) return [];

      const out: DomainAuthority[] = [];
      // The API caps a request at 100 domains; batch rather than truncate, so
      // a caller asking about a full SERP never silently loses rows.
      for (let i = 0; i < cleaned.length; i += 100) {
        const batch = cleaned.slice(i, i + 100);

        const response = await doFetch(OPR_BASE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ domains: batch }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          throw new OpenPageRankError(
            `OpenPageRank failed with HTTP ${response.status}`,
            response.status,
          );
        }
        const body: {
          results?: Array<{
            domain?: string;
            found?: boolean;
            open_page_rank?: number | string | null;
            rank?: number | string | null;
          }>;
        } = await response.json();
        for (const row of body.results ?? []) {
          out.push({
            domain: row.domain ?? "",
            // `found: false` means the domain is absent from the web graph, and
            // the numeric fields come back null. Treat 0/absent as unknown
            // rather than as a genuine zero-authority signal.
            pageRank: toNumberOrNull(row.open_page_rank),
            globalRank: toNumberOrNull(row.rank),
          });
        }
      }
      return out;
    },
  };
}

export function normaliseDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function toNumberOrNull(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}
