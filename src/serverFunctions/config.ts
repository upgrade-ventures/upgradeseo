import { createServerFn } from "@tanstack/react-start";
import { resolveProviderKey } from "@/server/features/provider-keys/providerKeys";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

export const getSeoApiKeyStatus = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    // Any working keyword data source counts as configured, in precedence
    // order: the organization's own key, then the instance environment.
    // Both absent is genuinely unconfigured: there is then no keyword data
    // source at all.
    // Any keyword data source counts as configured.
    const [bing, googleAds] = await Promise.all([
      resolveProviderKey(context.organizationId, "bing"),
      resolveProviderKey(context.organizationId, "google_ads"),
    ]);
    return { configured: Boolean(bing?.secret) || Boolean(googleAds?.secret) };
  });
