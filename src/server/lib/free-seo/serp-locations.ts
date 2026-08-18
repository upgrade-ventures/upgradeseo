import { MARKETS } from "@/server/lib/free-seo/markets";

/**
 * The locations rank tracking can actually target on the free stack.
 *
 * The paid registry this replaces listed every city, county and DMA region a
 * country has (~9.5MB for the US alone). Nothing free reaches that grain:
 * Bing Webmaster takes a country/language pair and Search Console takes a
 * country, so a city sent down the free path would not change a single number
 * that comes back. Listing cities we cannot target would be a promise the
 * data cannot keep, so the list stops at the market grain markets.ts defines
 * and says "Country" on every row.
 *
 * A market table lookup is in-process, so there is nothing to fetch, cache or
 * warm here.
 */
export interface SerpLocationResult {
  locationCode: number;
  locationName: string;
  locationType: string;
  displayLabel: string;
}

/**
 * `countryCode` is ISO 3166-1 alpha-2 ("us", "gb"), which is exactly how
 * markets.ts keys its Bing column. A country the free stack has no market row
 * for returns an empty list rather than a nearest neighbour: silently
 * targeting a different country is worse than offering nothing.
 */
export function serpLocationsForCountry(
  countryCode: string,
): SerpLocationResult[] {
  const iso = countryCode.trim().toLowerCase();
  return MARKETS.filter((market) => market.bingCountry === iso).map(
    (market) => ({
      locationCode: market.locationCode,
      locationName: market.label,
      locationType: "Country",
      displayLabel: market.label,
    }),
  );
}
