import type { getProviderKeys } from "@/serverFunctions/providerKeys";

export type ProviderStatus = Awaited<
  ReturnType<typeof getProviderKeys>
>[number];

export type Draft = { parts: Record<string, string>; publicIdentifier: string };

export const EMPTY_DRAFT: Draft = { parts: {}, publicIdentifier: "" };

/** DOM id of a provider row, so another section can scroll one into view. */
export function providerRowId(provider: string) {
  return `key-row-${provider}`;
}

/**
 * Where each credential comes from, so the copy can send people straight there.
 * Every provider here is free. The blurbs say plainly whether the app reads the
 * value yet: a green badge over a key nothing consumes is a silent lie, and
 * this page shipped exactly that before.
 */
export const PROVIDER_HELP: Record<
  string,
  { blurb: string; href: string; hrefLabel: string; unread?: string }
> = {
  microsoft_ads: {
    blurb:
      "Real search volume and real CPC on Microsoft/Bing, with 12 months of history. The developer token is self-service (sign in as Super Admin, press Request Token), so unlike Google Ads there is no approval wait. One trap: the API needs a real Microsoft account — an Ads login created with Sign in with Google cannot authorize it. Create a Microsoft account for the same email first. Credentials JSON: developerToken plus either refreshToken and clientId (long-lived) or an accessToken (expires within the hour).",
    href: "https://developers.ads.microsoft.com/Account",
    hrefLabel: "Microsoft Advertising Developer Portal",
  },
  brightdata: {
    blurb:
      "Live Google positions for competitor domains. This is the only source here that SCRAPES Google rather than reading a licensed API, and Bright Data's contract places that legal exposure on you, not on them. Off unless you add a key. 5,000 records a month free, no card.",
    href: "https://brightdata.com/products/serp-api",
    hrefLabel: "Bright Data SERP API",
  },
  google_ads: {
    blurb:
      "Real Google search volume, CPC and 12 months of seasonality. Free: no per-call charge, and a manager account needs no card. The developer token needs Google's approval, so apply early.",
    href: "https://ads.google.com/aw/apicenter",
    hrefLabel: "Google Ads API Center",
  },
  foundery: {
    blurb:
      "Azure AI Foundry, or any OpenAI-compatible endpoint. Runs the in-app SEO agent on your own deployment instead of a paid AI vendor. Endpoint format: https://RESOURCE.services.ai.azure.com|DEPLOYMENT — the resource host, a pipe, then the deployment name. Do not paste the full /openai/deployments/… REST URL; the app builds its own route and the two do not compose.",
    href: "https://ai.azure.com/",
    hrefLabel: "Azure AI Foundry",
  },
  bing: {
    blurb:
      "Free, no card, and it works immediately with no approval. Keyword volume and ideas. Volume is Bing volume, not Google, so use it to rank keywords against each other rather than as absolute demand.",
    href: "https://www.bing.com/webmasters/",
    hrefLabel: "Bing Webmaster Tools → Settings → API access",
  },
  openpagerank: {
    blurb:
      "Free tier covers 30,000 domains a month. Powers domain authority on Domain Overview and the difficulty proxy shown against keywords. Without it Domain Overview has no authority column. The key is now minted by signing in with a Keywords Everywhere API key, not issued by OpenPageRank directly.",
    href: "https://keywordseverywhere.com/",
    hrefLabel: "Keywords Everywhere → API key, then sign in to OpenPageRank",
  },
  google_oauth: {
    blurb:
      "Set these as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment. Saving them here stores them, but the OAuth flow still reads the environment, so this row does not connect Search Console on its own.",
    href: "https://console.cloud.google.com/apis/credentials",
    hrefLabel: "Google Cloud Console → Credentials",
  },
};
