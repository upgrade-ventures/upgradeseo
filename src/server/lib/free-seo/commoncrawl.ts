/**
 * Common Crawl client — a competitor's page inventory and actual page content,
 * free, with ZERO requests hitting their server.
 *
 * This is the free replacement for the paid competitor endpoints. It does
 * not answer "what does competitor.com RANK for" (nothing free and licensed
 * does). It answers "what does competitor.com PUBLISH and therefore target",
 * which for a content-marketing competitor is most of the same information.
 *
 * Two steps: the CDX index lists every URL Common Crawl holds for a domain,
 * along with a WARC file pointer; a Range request against that pointer returns
 * the archived HTML. No key, no account, no cost. The `commoncrawl` bucket is
 * an AWS Open Data Sponsorship, so egress is free and it is NOT requester-pays.
 *
 * ⚠️ GOTCHA 1 — NEVER use a wildcard URL. `?url=domain.com/*` returns HTTP 504
 * after ~11.5s, reproducibly, on both current and older indexes. The working
 * form is `matchType=domain` with an explicit `fl=` field list, which returned
 * HTTP 200 in ~8.5s. Measured 2026-08-15.
 *
 * ⚠️ GOTCHA 2 — the CDX server is unreliable and needs retries. Measured
 * 2026-08-15: the SAME query returned HTTP 200 in 19.8s and HTTP 504 thirty
 * seconds earlier. Roughly half of attempts failed in a single sitting, and
 * the failures are load-dependent, not shape-dependent: narrowing `limit` or
 * dropping fields did not help, and `showNumPages` failed too. Latency runs
 * 8-20s even on success, so timeouts must be generous. Without retry a batch
 * job silently loses half its competitors every run.
 *
 * ⚠️ GOTCHA 3 — `limit` truncates in SURT (sorted URL) order, not randomly,
 * so a small limit systematically drops the deeper parts of a site. Measured
 * on antler.co: at limit=200 the result was 100% English and contained ZERO
 * Arabic pages; at limit=1000 the same query returned 11 "ara,eng" and 22
 * "por,eng" pages. A truncated inventory therefore produces a FALSE NEGATIVE
 * about which markets a competitor courts. Ask for far more rows than seems
 * necessary, and treat a full-to-the-limit result as incomplete.
 *
 * ⚠️ GOTCHA 4 — Common Crawl is a donation-funded nonprofit, not an SLA. Even
 * with retries a run can come back empty, so callers must treat failure as
 * "no data this month", never as "this competitor has no pages". `domainUrls`
 * returns null on failure and [] on a genuine empty result, and those two
 * cases must never be collapsed.
 */

const CDX_BASE = "https://index.commoncrawl.org";
const DATA_BASE = "https://data.commoncrawl.org";
const COLLINFO = `${CDX_BASE}/collinfo.json`;

/** Common Crawl asks crawlers to identify themselves. */
const USER_AGENT = "UpgradeSEO/1.0 (+)";

/** A domain query can take ~9s on a good day and this is a batch job. */
const CDX_TIMEOUT_MS = 120_000;
const WARC_TIMEOUT_MS = 60_000;
const MAX_WARC_BYTES = 5_000_000;

/**
 * Rows requested per domain. High on purpose: truncation is biased, not
 * random (GOTCHA 3). One query per competitor per month, so the cost of
 * asking for too many is a few hundred KB, and the cost of asking for too few
 * is a wrong answer about which markets they target.
 */
export const DEFAULT_CDX_LIMIT = 2000;

export interface CdxRecord {
  url: string;
  /** HTTP status Common Crawl saw. Only "200" rows carry usable content. */
  status: string;
  /** ISO 639-3, comma-separated for multilingual pages ("ara,eng"). */
  languages: string | null;
  /** WARC pointer. Present only when the caller asked for these fields. */
  filename?: string;
  offset?: string;
  length?: string;
}

interface CommonCrawlClientOptions {
  fetchImpl?: typeof fetch;
  cdxTimeoutMs?: number;
  warcTimeoutMs?: number;
  /** Total CDX attempts, including the first. See GOTCHA 2. */
  cdxAttempts?: number;
  /** Injectable so tests do not actually sleep. */
  sleepImpl?: (ms: number) => Promise<void>;
}

export function createCommonCrawlClient(
  options: CommonCrawlClientOptions = {},
) {
  const doFetch = options.fetchImpl ?? fetch;
  const cdxTimeoutMs = options.cdxTimeoutMs ?? CDX_TIMEOUT_MS;
  const warcTimeoutMs = options.warcTimeoutMs ?? WARC_TIMEOUT_MS;
  const cdxAttempts = Math.max(1, options.cdxAttempts ?? 3);
  const sleep =
    options.sleepImpl ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  /**
   * One CDX GET with bounded retry. Retries only on failure, never on a 404,
   * which is a real answer meaning "nothing indexed for this domain".
   */
  async function cdxFetch(url: string): Promise<Response | null> {
    for (let attempt = 1; attempt <= cdxAttempts; attempt++) {
      try {
        const response = await doFetch(url, {
          headers: { "user-agent": USER_AGENT, accept: "application/json" },
          signal: AbortSignal.timeout(cdxTimeoutMs),
        });
        if (response.ok || response.status === 404) return response;
      } catch {
        // Timeout or network error; falls through to the backoff below.
      }
      // Linear backoff. The failures are load-dependent, so waiting longer
      // genuinely helps, but this runs monthly and must not stall a queue.
      if (attempt < cdxAttempts) await sleep(2_000 * attempt);
    }
    return null;
  }

  return {
    /**
     * Newest crawl id, e.g. "CC-MAIN-2026-30". Common Crawl ships roughly
     * monthly and `collinfo.json` is newest-first.
     */
    async latestCrawlId(): Promise<string | null> {
      const response = await cdxFetch(COLLINFO);
      if (!response?.ok) return null;
      try {
        const body: Array<{ id?: string }> = await response.json();
        return body[0]?.id ?? null;
      } catch {
        return null;
      }
    },

    /**
     * Every URL Common Crawl holds for `domain`, including subdomains.
     *
     * Returns null when the query failed (504, timeout, network) and [] when
     * the index genuinely holds nothing. Collapsing those two would report a
     * live competitor as having no web presence.
     */
    async domainUrls(input: {
      domain: string;
      crawlId: string;
      limit?: number;
      /** Include WARC pointers so the rows can be passed to fetchWarcRecord. */
      withContentPointers?: boolean;
    }): Promise<CdxRecord[] | null> {
      const fields = input.withContentPointers
        ? "url,status,languages,filename,offset,length"
        : "url,status,languages";

      const url = new URL(`${CDX_BASE}/${input.crawlId}-index`);
      url.searchParams.set("url", input.domain);
      // matchType=domain, never a "/*" wildcard — see GOTCHA 1.
      url.searchParams.set("matchType", "domain");
      url.searchParams.set("output", "json");
      url.searchParams.set("fl", fields);
      // Default deliberately high: see GOTCHA 3. Under-asking here does not
      // return a smaller sample, it returns a biased one.
      url.searchParams.set("limit", String(input.limit ?? DEFAULT_CDX_LIMIT));

      const response = await cdxFetch(url.toString());
      // 404 is the index's way of saying it holds nothing for this domain;
      // exhausting the retries (null) is a failure, not an empty result.
      if (!response) return null;
      if (response.status === 404) return [];
      if (!response.ok) return null;

      const text = await response.text();
      const records: CdxRecord[] = [];
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
          const row: unknown = JSON.parse(trimmed);
          if (!isCdxRow(row)) continue;
          records.push({
            url: row.url,
            status: row.status ?? "",
            languages: row.languages ?? null,
            filename: row.filename,
            offset: row.offset,
            length: row.length,
          });
        } catch {
          // One malformed row must not discard the other 399.
        }
      }
      return records;
    },

    /**
     * The archived HTML for one CDX record, via a Range read of the WARC file.
     *
     * The response is a gzip member containing WARC headers, then the original
     * HTTP response headers, then the body — three blocks separated by blank
     * lines. We return the body only.
     */
    async fetchWarcRecord(record: CdxRecord): Promise<string | null> {
      if (!record.filename || !record.offset || !record.length) return null;
      const offset = Number(record.offset);
      const length = Number(record.length);
      if (!Number.isFinite(offset) || !Number.isFinite(length)) return null;
      if (length > MAX_WARC_BYTES) return null;

      let response: Response;
      try {
        response = await doFetch(`${DATA_BASE}/${record.filename}`, {
          headers: {
            "user-agent": USER_AGENT,
            range: `bytes=${offset}-${offset + length - 1}`,
          },
          signal: AbortSignal.timeout(warcTimeoutMs),
        });
      } catch {
        return null;
      }
      // A range read answers 206; a 200 means the range was ignored and we are
      // about to read a multi-gigabyte file, so refuse it.
      if (response.status !== 206 || !response.body) return null;

      let raw: string;
      try {
        const stream = response.body.pipeThrough(
          new DecompressionStream("gzip"),
        );
        raw = await new Response(stream).text();
      } catch {
        return null;
      }

      return extractHttpBody(raw);
    },
  };
}

/**
 * A WARC record is: WARC headers, blank line, HTTP response headers, blank
 * line, body. Split on the second blank line and keep the rest.
 */
/** JSON.parse returns `any`; narrow it before trusting a single field. */
function isCdxRow(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { url?: unknown }).url === "string"
  );
}

export function extractHttpBody(raw: string): string | null {
  const separator = /\r?\n\r?\n/;
  const first = raw.search(separator);
  if (first === -1) return null;
  const afterWarcHeaders = raw.slice(first).replace(separator, "");
  const second = afterWarcHeaders.search(separator);
  if (second === -1) return null;
  const body = afterWarcHeaders.slice(second).replace(separator, "");
  return body.length > 0 ? body : null;
}

export type CommonCrawlClient = ReturnType<typeof createCommonCrawlClient>;
