/**
 * The free provider layer.
 *
 * Every number it returns is real data from a free API, or it is absent. No
 * field is ever defaulted to zero to fill a gap.
 *
 * SOURCE PRECEDENCE for keyword volume and CPC, and why:
 *   1. Microsoft Advertising  real volume + real CPC. FIRST because its
 *                             developer token is self-service, so it works the
 *                             same hour on any account.
 *   2. Google Ads             real Google volume + CPC, but Basic Access is a
 *                             manual review that is routinely refused to small
 *                             startups, so it cannot be the default.
 *   3. Bing Webmaster         impressions only, no CPC. The last resort.
 *
 * WHAT IS AND IS NOT COVERED, so no caller assumes parity:
 *   ✓ keyword volume, CPC, seasonality .. Microsoft Ads / Google Ads
 *   ✓ competitor keyword discovery ...... URL seed on either ads API
 *   ✓ domain authority .................. OpenPageRank, any domain
 *   ✓ own-site rank and queries ......... Search Console / Bing GetQueryStats
 *   ✗ live SERP position for a domain you do not own. No free licensed source
 *     provides it. Callers must render that as explicitly unavailable.
 */

import { createBingClient, defaultWindow } from "@/server/lib/free-seo/bing";
import { createGoogleSuggestClient } from "@/server/lib/free-seo/google-suggest";
import { createOpenPageRankClient } from "@/server/lib/free-seo/openpagerank";
import { estimateDifficulty } from "@/server/lib/free-seo/difficulty";
import { bingMarketFor, marketFor } from "@/server/lib/free-seo/markets";
import {
  createMicrosoftAdsClient,
  parseMicrosoftAdsCredentials,
  type MicrosoftAdsKeyword,
} from "@/server/lib/free-seo/microsoft-ads";
import {
  createGoogleAdsClient,
  parseGoogleAdsCredentials,
  type GoogleAdsKeyword,
} from "@/server/lib/free-seo/google-ads";
import type { EnrichedKeyword } from "@/server/features/keywords/services/research/helpers";

export interface FreeSeoEnv {
  BING_WEBMASTER_API_KEY?: string;
  OPENPAGERANK_API_KEY?: string;
  /** JSON blob: developerToken, clientId, clientSecret, refreshToken. */
  GOOGLE_ADS_CREDENTIALS?: string;
  /** Manager (MCC) customer id. */
  GOOGLE_ADS_CUSTOMER_ID?: string;
  /** JSON blob: developerToken, accessToken. */
  MICROSOFT_ADS_CREDENTIALS?: string;
  /** "customerId|accountId". */
  MICROSOFT_ADS_ACCOUNT?: string;
}

/**
 * Microsoft returns real volume AND a real bid, so it maps to the same shape
 * as Google Ads. Values Microsoft did not report stay null rather than 0.
 */
function microsoftAdsToEnriched(
  rows: MicrosoftAdsKeyword[],
): EnrichedKeyword[] {
  return rows.map((row) => ({
    keyword: row.keyword,
    searchVolume: row.searchVolume,
    // Microsoft returns newest first; the app renders oldest first.
    trend: row.monthlySearchCounts
      .map((searchVolume, index) => ({
        year: 0,
        month: index + 1,
        searchVolume,
      }))
      .toReversed(),
    cpc: row.suggestedBid,
    competition: row.competition,
    keywordDifficulty: null,
    intent: "unknown" as const,
  }));
}

/** True once any keyword data source is connected. */
export function isFreeMode(env: FreeSeoEnv): boolean {
  return (
    Boolean(env.MICROSOFT_ADS_CREDENTIALS?.trim()) ||
    Boolean(env.GOOGLE_ADS_CREDENTIALS?.trim()) ||
    Boolean(env.BING_WEBMASTER_API_KEY?.trim())
  );
}

/** Google Ads rows into the app shape. Unreported values stay null. */
function googleAdsToEnriched(rows: GoogleAdsKeyword[]): EnrichedKeyword[] {
  return rows.map((row) => ({
    keyword: row.keyword,
    searchVolume: row.avgMonthlySearches,
    trend: row.monthlySearches.map((m) => ({
      year: m.year,
      month: m.month,
      searchVolume: m.searchVolume,
    })),
    // Midpoint of Google's top-of-page bid range is the honest single number.
    // Null when Google reported no bid data rather than 0, which would read as
    // "free to advertise on".
    cpc:
      row.lowTopOfPageBid !== null && row.highTopOfPageBid !== null
        ? (row.lowTopOfPageBid + row.highTopOfPageBid) / 2
        : (row.highTopOfPageBid ?? row.lowTopOfPageBid),
    competition:
      row.competitionIndex === null ? null : row.competitionIndex / 100,
    keywordDifficulty: null,
    intent: "unknown" as const,
  }));
}

// The market table moved to markets.ts, because Search Console needs the same
// places expressed as ISO 3166-1 alpha-3 and two copies would drift. Re-exported
// here so existing importers of this module keep working unchanged.
export { bingMarketFor };

/**
 * Turn Bing keyword rows into the app's own EnrichedKeyword shape.
 *
 * Fields we cannot source are left NULL on purpose. A null CPC renders as "no
 * data"; a zero would read as "this keyword is free to advertise on", which is
 * a different and false claim.
 */
/**
 * Strip a phrase to comparable letters and digits.
 *
 * Punctuation is removed rather than replaced with a space so "co-founder",
 * "co founder" and "cofounder" all collapse to the same run of characters and
 * compare equal. Callers squash the candidate and keep the seed tokenised, so
 * a token can be found inside a candidate written a different way.
 */
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Drop related keywords that do not carry every meaningful word of the seed.
 *
 * Bing's `GetRelatedKeywords` matches loosely on single tokens, so a seed like
 * "technical co-founder" comes back led by "chattahoochee technical college"
 * and a page of other colleges: they share "technical", carry far more volume,
 * and the volume sort then puts them above every genuine match. Requiring all
 * of the seed's own words keeps a high-volume near-miss from displacing a
 * low-volume real one.
 *
 * Single-character tokens are ignored because they survive almost any
 * candidate and would not narrow anything.
 */
export function relatedRowsMatchingSeed<T extends { Query: string }>(
  rows: T[],
  seedKeyword: string,
): T[] {
  const tokens = seedKeyword
    .split(/\s+/)
    .map(squash)
    .filter((token) => token.length > 1);
  if (tokens.length === 0) return rows;
  return rows.filter((row) => {
    const candidate = squash(row.Query);
    return tokens.every((token) => candidate.includes(token));
  });
}

export function bingRowsToEnriched(
  rows: Array<{ Query: string; Impressions: number; BroadImpressions: number }>,
): EnrichedKeyword[] {
  return rows.map((row) => ({
    keyword: row.Query,
    // Bing impressions are the closest free analogue to search volume.
    searchVolume: Number.isFinite(row.Impressions) ? row.Impressions : null,
    trend: [],
    cpc: null, // Bing Webmaster exposes no bid data
    competition: null, // Bing exposes none
    keywordDifficulty: null, // difficulty comes from the authority proxy
    intent: "unknown" as const,
  }));
}

export function createFreeSeoProvider(env: FreeSeoEnv) {
  const bingKey = env.BING_WEBMASTER_API_KEY?.trim();
  const oprKey = env.OPENPAGERANK_API_KEY?.trim();
  const bing = bingKey ? createBingClient({ apiKey: bingKey }) : null;
  const opr = oprKey ? createOpenPageRankClient({ apiKey: oprKey }) : null;

  const adsCredentials = env.GOOGLE_ADS_CREDENTIALS?.trim()
    ? parseGoogleAdsCredentials(
        env.GOOGLE_ADS_CREDENTIALS,
        env.GOOGLE_ADS_CUSTOMER_ID ?? null,
      )
    : null;
  const googleAds = adsCredentials
    ? createGoogleAdsClient({ credentials: adsCredentials })
    : null;

  const microsoftCredentials = env.MICROSOFT_ADS_CREDENTIALS?.trim()
    ? parseMicrosoftAdsCredentials(
        env.MICROSOFT_ADS_CREDENTIALS,
        env.MICROSOFT_ADS_ACCOUNT ?? null,
      )
    : null;
  const microsoftAds = microsoftCredentials
    ? createMicrosoftAdsClient({ credentials: microsoftCredentials })
    : null;

  return {
    available: Boolean(bing) || Boolean(googleAds) || Boolean(microsoftAds),
    /**
     * Keyword IDEAS specifically, which Google Autocomplete answers with no key
     * at all. Separate from `available` because that one also gates rank
     * tracking and metric refresh, and neither of those has a keyless source —
     * flipping it would let them run with nothing behind them.
     */
    ideasAvailable: true,
    /** Which source will answer, so callers can label the numbers honestly. */
    volumeSource: microsoftAds
      ? ("microsoft_ads" as const)
      : googleAds
        ? ("google_ads" as const)
        : ("bing" as const),

    /** Keyword ideas for a seed term — the free replacement for related/
     * suggestions/ideas, all three of which collapse to one Bing method. */
    async keywordIdeas(input: {
      seedKeyword: string;
      locationCode: number;
      limit: number;
      now?: Date;
    }): Promise<EnrichedKeyword[]> {
      if (microsoftAds) {
        return microsoftAdsToEnriched(
          await microsoftAds.keywordIdeas({
            keywords: [input.seedKeyword],
            limit: input.limit,
          }),
        );
      }
      if (googleAds) {
        const market = marketFor(input.locationCode);
        return googleAdsToEnriched(
          await googleAds.keywordIdeas({
            keywords: [input.seedKeyword],
            geoTargetConstant: market.googleAdsGeoTarget,
            languageConstant: market.googleAdsLanguage,
            limit: input.limit,
          }),
        );
      }
      const market = bingMarketFor(input.locationCode);

      // Bing first, because its rows carry an impressions figure and
      // autocomplete carries no number at all. Relevance is filtered because
      // GetRelatedKeywords matches on single tokens.
      const bingRows = bing
        ? relatedRowsMatchingSeed(
            await bing.relatedKeywords({
              query: input.seedKeyword,
              country: market.country,
              language: market.language,
              ...defaultWindow(input.now ?? new Date()),
            }),
            input.seedKeyword,
          )
        : [];
      const fromBing = bingRowsToEnriched(bingRows);
      if (fromBing.length >= input.limit) return fromBing.slice(0, input.limit);

      // Autocomplete tops up whatever Bing could not answer, which for any B2B
      // seed is usually everything. No key, so it runs even with nothing
      // connected — the difference between an empty screen and a usable one.
      const suggested = await createGoogleSuggestClient().keywordIdeas({
        seedKeyword: input.seedKeyword,
        language: market.language.split("-")[0] ?? "en",
        country: market.country,
        limit: input.limit,
      });
      const seen = new Set(fromBing.map((row) => row.keyword.toLowerCase()));
      const topUp = suggested
        .filter((keyword) => !seen.has(keyword.toLowerCase()))
        .map((keyword) => ({
          keyword,
          // Autocomplete publishes no number. Null, never zero.
          searchVolume: null,
          trend: [],
          cpc: null,
          competition: null,
          keywordDifficulty: null,
          intent: "unknown" as const,
        }));
      return [...fromBing, ...topUp].slice(0, input.limit);
    },

    /** Volume for one specific keyword. */
    async keywordVolume(input: {
      keyword: string;
      locationCode: number;
      now?: Date;
    }): Promise<EnrichedKeyword | null> {
      // Same precedence as keywordIdeas. Without this branch a configured
      // Microsoft account was skipped here and the lookup fell through to
      // Bing impressions, which are not the same measurement.
      if (microsoftAds) {
        const rows = await microsoftAds.keywordIdeas({
          keywords: [input.keyword],
          limit: 1,
        });
        return microsoftAdsToEnriched(rows)[0] ?? null;
      }
      if (googleAds) {
        const market = marketFor(input.locationCode);
        const rows = await googleAds.historicalMetrics({
          keywords: [input.keyword],
          geoTargetConstant: market.googleAdsGeoTarget,
          languageConstant: market.googleAdsLanguage,
        });
        return googleAdsToEnriched(rows)[0] ?? null;
      }
      if (!bing) return null;
      const market = bingMarketFor(input.locationCode);
      const window = defaultWindow(input.now ?? new Date());
      const row = await bing.keyword({
        query: input.keyword,
        country: market.country,
        language: market.language,
        ...window,
      });
      return row ? (bingRowsToEnriched([row])[0] ?? null) : null;
    },

    /**
     * What a competitor's page or site targets, according to Google's own
     * keyword association model. The free answer to competitor keyword
     * discovery, and it needs no crawl index of our own.
     */
    async competitorKeywords(input: {
      url: string;
      locationCode: number;
      limit?: number;
    }): Promise<EnrichedKeyword[]> {
      // Microsoft accepts a URL seed too; the header has always claimed
      // "either ads API" while the code required Google.
      if (microsoftAds) {
        return microsoftAdsToEnriched(
          await microsoftAds.keywordIdeas({
            url: input.url,
            limit: input.limit ?? 100,
          }),
        );
      }
      if (!googleAds) return [];
      const market = marketFor(input.locationCode);
      return googleAdsToEnriched(
        await googleAds.keywordIdeas({
          url: input.url,
          geoTargetConstant: market.googleAdsGeoTarget,
          languageConstant: market.googleAdsLanguage,
          limit: input.limit ?? 100,
        }),
      );
    },

    /**
     * Real query performance for a site verified in Bing Webmaster Tools:
     * impressions, clicks and average position. This is the ONLY position data
     * available with no Google OAuth at all, which makes it the zero-friction
     * onboarding path. It is BING position, not Google, and every caller must
     * label it that way.
     */
    async ownSiteQueryStats(siteUrl: string) {
      if (!bing) return [];
      return bing.queryStats(siteUrl);
    },

    /** Inbound link counts for a site we have verified in Bing. */
    async ownSiteLinkCounts(siteUrl: string) {
      if (!bing) return [];
      return bing.linkCounts(siteUrl);
    },

    /** Domain authority for any domain, competitors included. */
    async domainAuthority(domains: string[]) {
      if (!opr) return [];
      return opr.authority(domains);
    },

    /**
     * Difficulty proxy for a keyword, given the domains currently ranking for
     * it. Returns null when authority is unknown — never a default number.
     */
    async difficultyFromRankingDomains(domains: string[]) {
      if (!opr || domains.length === 0) return null;
      return estimateDifficulty(await opr.authority(domains));
    },
  };
}
