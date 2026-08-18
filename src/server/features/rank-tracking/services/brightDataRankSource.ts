import { marketFor } from "@/server/lib/free-seo/markets";
import {
  createBrightDataClient,
  parseBrightDataCredentials,
  positionOf,
} from "@/server/lib/free-seo/brightdata";
import type {
  FreeRankCheckResult,
  FreeRankDevice,
  FreeRankSnapshotRow,
} from "@/server/features/rank-tracking/services/freeRankSource";
import type { TrackedKeyword } from "@/server/features/rank-tracking/services/freeRankSource";

/**
 * Live Google positions via Bright Data. Off unless the organization stored a
 * key. Every snapshot it produces is labelled as a scraped observation so no
 * reader mistakes it for a licensed measurement.
 */
export async function tryBrightDataPositions(input: {
  organizationId: string;
  domain: string;
  locationCode: number;
  devices: FreeRankDevice[];
  keywords: TrackedKeyword[];
}): Promise<FreeRankCheckResult | null> {
  const { resolveProviderKey } =
    await import("@/server/features/provider-keys/providerKeys");
  const stored = await resolveProviderKey(input.organizationId, "brightdata");
  const credentials = stored?.secret
    ? parseBrightDataCredentials(stored.secret, stored.publicIdentifier)
    : null;
  if (!credentials) return null;

  const client = createBrightDataClient({ credentials });
  const market = marketFor(input.locationCode);
  const rows: FreeRankSnapshotRow[] = [];

  for (const keyword of input.keywords) {
    const results = await client.search({
      query: keyword.keyword,
      gl: market.bingCountry,
      hl: market.bingLanguage.split("-")[0],
      // Left at the zone default. A "Google SERP Scraper" zone can do 1-100;
      // a standard SERP API zone caps at 10 and truncates silently.
    });
    const position = positionOf(results, input.domain);
    // Absent from the first 100 results is not a rank, so no row is written.
    // Writing 0 or 101 would invent a measurement we did not make.
    if (position === null) continue;
    const hit = results.find((row) => row.position === position);
    for (const device of input.devices) {
      rows.push({
        trackingKeywordId: keyword.id,
        keyword: keyword.keyword,
        device,
        position,
        url: hit?.url ?? null,
      });
    }
  }

  return {
    rows,
    // Keywords we actually queried, not rows written: a keyword outside the
    // first 100 results was still checked, it simply had no position.
    keywordsChecked: input.keywords.length,
    source: "brightdata_live_serp",
    notice:
      "Live Google positions via Bright Data. These are SCRAPED from Google, not read from a licensed API. A keyword with no position was outside the result window this zone returns (10 on a standard SERP API zone, up to 100 on a Google SERP Scraper zone), and is recorded as no position rather than as a number.",
  };
}
