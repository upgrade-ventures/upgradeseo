/**
 * One market table for the whole free stack.
 *
 * Three subsystems each need a different identifier for the same place, and
 * before this file they disagreed: the app uses numeric location codes,
 * Bing Webmaster takes a country/language pair, and Google Search Console
 * takes ISO 3166-1 alpha-3. Keeping the mapping in three places is how a
 * market silently goes missing from one report and not another.
 *
 * Only the markets Upgrade actually targets are listed. An unmapped code
 * falls back to US/en-US rather than throwing, because a slightly wrong
 * market is more useful than no data, and every caller is told via `exact`
 * which of the two it got.
 *
 * The language column is not decoration. Tunis is a French-first market and
 * Almaty is Russian-first; querying either in English returns the wrong
 * demand picture entirely.
 */

interface Market {
  /** Numeric location code, the id used across the app. */
  locationCode: number;
  /** Bing Webmaster country code, lowercase ISO 3166-1 alpha-2. */
  bingCountry: string;
  /** Bing Webmaster language tag. */
  bingLanguage: string;
  /** Google Search Console country dimension, ISO 3166-1 alpha-3. */
  gscCountry: string;
  /** ISO 639-3 codes we expect in Common Crawl's `languages` field. */
  contentLanguages: string[];
  /**
   * Languages whose presence is EVIDENCE that a site is courting this market.
   *
   * English is deliberately absent everywhere. It is the lingua franca of
   * startup content, so an English page is published by everyone and
   * discriminates between no two markets. Treating it as a signal made an
   * all-English US consultancy look like it was targeting Amman, Riyadh,
   * Dubai and Bangalore at once. An empty list means language alone can never
   * infer this market; only an explicit hreflang can.
   */
  distinctiveLanguages: string[];
  /**
   * Google Ads geoTargetConstant id for the COUNTRY. Google also publishes
   * city-level ids, but country level is the right grain for keyword demand:
   * city targeting thins the data without changing the ranking between terms.
   */
  googleAdsGeoTarget: string;
  /** Google Ads languageConstant id. */
  googleAdsLanguage: string;
  label: string;
}

export const MARKETS: readonly Market[] = [
  {
    locationCode: 2840,
    bingCountry: "us",
    bingLanguage: "en-US",
    gscCountry: "usa",
    contentLanguages: ["eng"],
    distinctiveLanguages: [],
    googleAdsGeoTarget: "geoTargetConstants/2840",
    googleAdsLanguage: "languageConstants/1000",
    label: "United States",
  },
  {
    locationCode: 2826,
    bingCountry: "gb",
    bingLanguage: "en-GB",
    gscCountry: "gbr",
    contentLanguages: ["eng"],
    distinctiveLanguages: [],
    googleAdsGeoTarget: "geoTargetConstants/2826",
    googleAdsLanguage: "languageConstants/1000",
    label: "United Kingdom",
  },
  {
    locationCode: 2400,
    bingCountry: "jo",
    bingLanguage: "en-US",
    gscCountry: "jor",
    contentLanguages: ["eng", "ara"],
    distinctiveLanguages: ["ara"],
    googleAdsGeoTarget: "geoTargetConstants/2400",
    googleAdsLanguage: "languageConstants/1000",
    label: "Jordan (Amman)",
  },
  {
    locationCode: 2788,
    bingCountry: "tn",
    bingLanguage: "fr-FR",
    gscCountry: "tun",
    contentLanguages: ["fra", "ara"],
    distinctiveLanguages: ["fra", "ara"],
    googleAdsGeoTarget: "geoTargetConstants/2788",
    googleAdsLanguage: "languageConstants/1002",
    label: "Tunisia (Tunis)",
  },
  {
    locationCode: 2792,
    bingCountry: "tr",
    bingLanguage: "tr-TR",
    gscCountry: "tur",
    contentLanguages: ["tur"],
    distinctiveLanguages: ["tur"],
    googleAdsGeoTarget: "geoTargetConstants/2792",
    googleAdsLanguage: "languageConstants/1037",
    label: "Türkiye (Istanbul)",
  },
  {
    locationCode: 2682,
    bingCountry: "sa",
    bingLanguage: "ar-SA",
    gscCountry: "sau",
    contentLanguages: ["ara", "eng"],
    distinctiveLanguages: ["ara"],
    googleAdsGeoTarget: "geoTargetConstants/2682",
    googleAdsLanguage: "languageConstants/1019",
    label: "Saudi Arabia (Riyadh)",
  },
  {
    locationCode: 2784,
    bingCountry: "ae",
    bingLanguage: "en-US",
    gscCountry: "are",
    contentLanguages: ["eng", "ara"],
    distinctiveLanguages: ["ara"],
    googleAdsGeoTarget: "geoTargetConstants/2784",
    googleAdsLanguage: "languageConstants/1000",
    label: "United Arab Emirates (Dubai)",
  },
  {
    locationCode: 2356,
    bingCountry: "in",
    bingLanguage: "en-IN",
    gscCountry: "ind",
    contentLanguages: ["eng"],
    distinctiveLanguages: [],
    googleAdsGeoTarget: "geoTargetConstants/2356",
    googleAdsLanguage: "languageConstants/1000",
    label: "India (Bangalore)",
  },
  {
    locationCode: 2398,
    bingCountry: "kz",
    bingLanguage: "ru-RU",
    gscCountry: "kaz",
    contentLanguages: ["rus", "kaz"],
    distinctiveLanguages: ["rus", "kaz"],
    googleAdsGeoTarget: "geoTargetConstants/2398",
    googleAdsLanguage: "languageConstants/1031",
    label: "Kazakhstan (Almaty)",
  },
] as const;

const BY_CODE = new Map(MARKETS.map((m) => [m.locationCode, m]));

const FALLBACK = MARKETS[0];

export function marketFor(locationCode: number): Market & { exact: boolean } {
  const hit = BY_CODE.get(locationCode);
  return hit ? { ...hit, exact: true } : { ...FALLBACK, exact: false };
}

/**
 * Bing's half of the table. Kept as its own function because `provider.ts`
 * and its tests already speak this shape.
 */
export function bingMarketFor(locationCode: number): {
  country: string;
  language: string;
  exact: boolean;
} {
  const market = marketFor(locationCode);
  return {
    country: market.bingCountry,
    language: market.bingLanguage,
    exact: market.exact,
  };
}

/** Search Console's half. Alpha-3, which nothing else in the app uses. */
export function gscCountryFor(locationCode: number): string {
  return marketFor(locationCode).gscCountry;
}

/**
 * Two sources describe the same language differently: Common Crawl reports
 * ISO 639-3 ("ara"), while a page's own `<html lang>` is 639-1, often with a
 * region ("ar-AE"). Without this map the `<html lang>` fallback would silently
 * never match and Arabic pages would look untargeted.
 */
const ISO1_TO_ISO3: Record<string, string> = {
  en: "eng",
  ar: "ara",
  fr: "fra",
  tr: "tur",
  ru: "rus",
  kk: "kaz",
};

function toIso3(code: string): string {
  const bare = code.trim().toLowerCase().split("-")[0];
  return ISO1_TO_ISO3[bare] ?? bare;
}

/**
 * Whether a page in `language` plausibly targets this market. Accepts Common
 * Crawl's 639-3 codes and a page's own 639-1 `lang` attribute. Used to decide
 * if a competitor's Arabic page counts as evidence of them contesting Riyadh.
 */
export function languageTargetsMarket(
  language: string | null | undefined,
  locationCode: number,
): boolean {
  if (!language) return false;
  const market = marketFor(locationCode);
  // Common Crawl reports multi-language pages as "ara,eng"; any match counts.
  const codes = language.split(",").map(toIso3);
  return codes.some((c) => market.contentLanguages.includes(c));
}

/**
 * Whether a page is EVIDENCE that its publisher is courting this market.
 *
 * Stricter than `languageTargetsMarket` on purpose. That function asks "could
 * this page be read here", which is true of every English page in every
 * market we track. This one asks "did they do something deliberate for this
 * market", which is the only question worth reporting.
 *
 * Two things count: a distinctive language, or an hreflang naming the country
 * outright. An hreflang is an explicit publisher declaration, so it outranks
 * language inference and works even for English-speaking markets.
 */
export function pageTargetsMarket(
  page: { language?: string | null; hreflang?: string[] },
  locationCode: number,
): boolean {
  const market = marketFor(locationCode);

  for (const tag of page.hreflang ?? []) {
    // "en-ae" / "ar-AE" both name the UAE; a bare "ar" names no country.
    const region = tag.trim().toLowerCase().split("-")[1];
    if (region && region === market.bingCountry) return true;
  }

  if (!page.language) return false;
  const codes = page.language.split(",").map(toIso3);
  return codes.some((c) => market.distinctiveLanguages.includes(c));
}
