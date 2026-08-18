/**
 * Provider-neutral keyword metric shapes.
 *
 * These are the rows the app stores and renders, independent of which source
 * produced them. The free providers (Microsoft Advertising, Google Ads, Bing
 * Webmaster) all map into this shape, which is why it lives here rather than
 * beside any one client.
 */

import type { MonthlySearch } from "@/types/keywords";

export type KeywordMetricRow = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  competitionLevel: string | null;
  keywordDifficulty: number | null;
  intent: string | null;
  monthlySearches: MonthlySearch[];
};
