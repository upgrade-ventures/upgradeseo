import type { OrganizationContext } from "@/server/auth/organizationContext";
import { resolveFreeSeoEnv } from "@/server/lib/free-seo/resolveFreeSeoEnv";
import { type EnrichedKeyword } from "./helpers";
import type { KeywordSource } from "./selection";
import { AppError } from "@/server/lib/errors";
import { createFreeSeoProvider } from "@/server/lib/free-seo/provider";

type FetchResearchRowsParams = {
  seedKeyword: string;
  locationCode: number;
  languageCode: string;
  resultLimit: number;
  source: KeywordSource;
  includeClickstreamData?: boolean;
};

/**
 * Free-mode keyword rows, or null when the paid path should be used.
 *
 * Shared by BOTH research entry points on purpose. Previously only
 * `fetchResearchRowsBySource` consulted free mode, so the 48 `googleAdsOnly`
 * countries went straight to the paid provider and a Bing key changed nothing for
 * them. Any new research entry point must call this first.
 *
 * Throws DATA_SOURCE_NOT_CONFIGURED when nothing at all is connected, so the
 * user gets an actionable message instead of a raw missing-env error.
 */
async function freeResearchRows(input: {
  seedKeyword: string;
  locationCode: number;
  resultLimit: number;
  organizationId: string;
}): Promise<EnrichedKeyword[]> {
  const free = createFreeSeoProvider(
    await resolveFreeSeoEnv(input.organizationId),
  );

  // `ideasAvailable`, not `available`: autocomplete needs no key, so keyword
  // ideas work on a fresh install with nothing connected.
  if (free.ideasAvailable) {
    return free.keywordIdeas({
      seedKeyword: input.seedKeyword,
      locationCode: input.locationCode,
      limit: input.resultLimit,
    });
  }

  throw new AppError(
    "DATA_SOURCE_NOT_CONFIGURED",
    "No keyword source could answer. Keyword ideas come from Google Autocomplete with no key; add Microsoft Advertising or Google Ads for search volume and CPC alongside them.",
  );
}

/**
 * Research rows for the countries the previous provider's Labs endpoints did
 * not cover. Kept as a distinct entry point because callers route to it by
 * country, but it now shares the single free implementation.
 */
export async function fetchGoogleAdsResearchRows(
  params: Omit<FetchResearchRowsParams, "source">,
  billingCustomer: OrganizationContext,
): Promise<EnrichedKeyword[]> {
  return freeResearchRows({
    seedKeyword: params.seedKeyword,
    locationCode: params.locationCode,
    resultLimit: params.resultLimit,
    organizationId: billingCustomer.organizationId,
  });
}

export async function fetchResearchRowsBySource(
  params: FetchResearchRowsParams,
  billingCustomer: OrganizationContext,
): Promise<EnrichedKeyword[]> {
  // The three former sources (related / suggestions / ideas) collapse onto one
  // free implementation, which is why `params.source` no longer branches here.
  return freeResearchRows({
    seedKeyword: params.seedKeyword,
    locationCode: params.locationCode,
    resultLimit: params.resultLimit,
    organizationId: billingCustomer.organizationId,
  });
}
