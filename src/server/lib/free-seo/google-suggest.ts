/**
 * Google Autocomplete as a keyword-idea source.
 *
 * WHY THIS EXISTS. Every other free source here needs an account, and the one
 * that does not need an ads approval — Bing's `GetRelatedKeywords` — matches on
 * single tokens against a consumer query corpus. Seeded with "technical
 * co-founder" it returns a page of technical colleges; seeded with "startup
 * incorporation" it returns Windows startup settings. That is not a relevance
 * bug we can filter our way out of, it is the wrong corpus, so a B2B install
 * had no usable keyword research at all.
 *
 * This endpoint is what Google's own search box calls as you type. It is
 * public, unauthenticated, and returns real Google queries, which makes it the
 * only free source that answers a B2B seed with B2B keywords.
 *
 * ⚠️ NO VOLUME, NO CPC, EVER. Autocomplete ranks by popularity but publishes no
 * number, so every metric from this source is NULL. That is a genuine absence
 * and must render as "no data", never as zero — a zero would read as "nobody
 * searches this", which is the opposite of what an autocomplete hit means.
 * Volume for these keywords has to come from an ads API.
 */

const SUGGEST_URL = "https://suggestqueries.google.com/complete/search";

/** Google returns at most ten per request, so one call is a thin result. */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

/**
 * Question and comparison prefixes surface intent that a bare alphabet sweep
 * misses: "how to find a technical co-founder" never appears under "t".
 */
const MODIFIERS = ["how to", "what is", "best", "vs", "for"];

/** Google throttles a burst from one address; this stays well under it. */
const CONCURRENCY = 6;

async function suggestOnce(
  query: string,
  market: { language: string; country: string },
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<string[]> {
  const url = new URL(SUGGEST_URL);
  url.searchParams.set("q", query);
  // The firefox client returns plain JSON. The default returns JSONP, which
  // would need string surgery to parse.
  url.searchParams.set("client", "firefox");
  url.searchParams.set("hl", market.language);
  url.searchParams.set("gl", market.country);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return [];
    const parsed: unknown = await response.json();
    // Shape is [query, [suggestions], ...]. Anything else is treated as empty
    // rather than thrown: one bad variation must not lose the whole sweep.
    if (!Array.isArray(parsed) || !Array.isArray(parsed[1])) return [];
    return parsed[1].filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Run in small batches so one seed does not open 30 sockets at once. */
async function inBatches<T, R>(
  items: T[],
  size: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(
      ...(await Promise.all(items.slice(index, index + size).map(run))),
    );
  }
  return results;
}

export function createGoogleSuggestClient(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}) {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 10_000;

  return {
    /**
     * Keyword ideas for a seed, deduplicated and in Google's own order.
     *
     * The seed itself is dropped: it is what the user typed, not an idea.
     */
    async keywordIdeas(input: {
      seedKeyword: string;
      language: string;
      country: string;
      limit?: number;
    }): Promise<string[]> {
      const seed = input.seedKeyword.trim();
      if (!seed) return [];
      const market = { language: input.language, country: input.country };

      const variations = [
        seed,
        ...ALPHABET.map((letter) => `${seed} ${letter}`),
        ...MODIFIERS.map((modifier) => `${modifier} ${seed}`),
      ];

      const batches = await inBatches(variations, CONCURRENCY, (variation) =>
        suggestOnce(variation, market, fetchImpl, timeoutMs),
      );

      // A Set keeps Google's ordering, which is roughly popularity-first.
      const seen = new Set<string>();
      const seedLower = seed.toLowerCase();
      for (const suggestion of batches.flat()) {
        const trimmed = suggestion.trim();
        if (trimmed && trimmed.toLowerCase() !== seedLower) seen.add(trimmed);
      }
      return [...seen].slice(0, input.limit ?? 150);
    },
  };
}
