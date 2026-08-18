import type { FreeSeoEnv } from "@/server/lib/free-seo/provider";

/**
 * Resolve every stored provider key into the env object `createFreeSeoProvider`
 * expects.
 *
 * This exists because the resolve-and-build block was previously copied at five
 * call sites, and each copy had to remember every provider. Microsoft
 * Advertising was added to the registry and to the provider factory but to none
 * of the five copies, so the key a user saved was silently ignored everywhere:
 * `available` stayed false and the UI kept telling them to connect a source
 * they had already connected. One shared resolver means a new provider is one
 * edit, and no call site can omit it.
 */
export async function resolveFreeSeoEnv(
  organizationId: string,
): Promise<FreeSeoEnv> {
  // Imported lazily for the same reason the call sites did: it pulls in the DB
  // binding, and the pure row-mapping helpers are unit-tested without one.
  const { resolveProviderKey } =
    await import("@/server/features/provider-keys/providerKeys");

  const [bing, openPageRank, googleAds, microsoftAds] = await Promise.all([
    resolveProviderKey(organizationId, "bing"),
    resolveProviderKey(organizationId, "openpagerank"),
    resolveProviderKey(organizationId, "google_ads"),
    resolveProviderKey(organizationId, "microsoft_ads"),
  ]);

  return {
    BING_WEBMASTER_API_KEY: bing?.secret,
    OPENPAGERANK_API_KEY: openPageRank?.secret,
    GOOGLE_ADS_CREDENTIALS: googleAds?.secret,
    GOOGLE_ADS_CUSTOMER_ID: googleAds?.publicIdentifier ?? undefined,
    MICROSOFT_ADS_CREDENTIALS: microsoftAds?.secret,
    MICROSOFT_ADS_ACCOUNT: microsoftAds?.publicIdentifier ?? undefined,
  };
}
