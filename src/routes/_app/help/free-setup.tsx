import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink } from "lucide-react";

/**
 * The default setup path. Every key here is free, permanently, with no card and
 * no trial clock — so a new user can get a working install without spending
 * anything. There is no paid path: every feature runs on these sources.
 */
export const Route = createFileRoute("/_app/help/free-setup")({
  component: FreeSetupHelpPage,
});

type Source = {
  name: string;
  url: string;
  cost: string;
  unlocks: string;
  minutes: string;
  steps: string[];
  caveat?: string;
};

const SOURCES: Source[] = [
  {
    name: "Microsoft Advertising",
    url: "https://ads.microsoft.com/",
    cost: "Free, no card, no approval wait",
    unlocks:
      "Keyword volume, CPC and competition, plus competitor keyword discovery from a URL",
    minutes: "15 minutes",
    steps: [
      "Create a Microsoft Advertising account. No card and no campaign are required.",
      "In Account settings, Developer settings, request a developer token. It is issued immediately, with no manual review.",
      "Register an application in Microsoft Entra and mint an OAuth access token for it.",
      "Paste the developer token and access token into Settings, Data provider keys, Microsoft Advertising, and put the customer ID and account ID in the second field separated by a pipe, for example 1234567|9876543.",
    ],
    caveat:
      "Volume here is Microsoft's, not Google's, so treat it as relative demand rather than absolute Google numbers. It is the fastest route to a working install because nothing is gated on review. Both IDs are required: with only one the key is stored but silently ignored.",
  },
  {
    name: "Google Ads",
    url: "https://ads.google.com/aw/apicenter",
    cost: "Free, no per-call charge",
    unlocks:
      "REAL Google search volume, CPC, competition and 12 months of seasonality, plus competitor keyword discovery",
    minutes: "20 minutes, then an approval wait",
    steps: [
      "Create a Google Ads manager (MCC) account. No card and no campaign are required.",
      "In the API Center, apply for a developer token. Google reviews this by hand, so apply before you need it.",
      "Create an OAuth client (Web application) in Google Cloud Console and mint a refresh token for it.",
      "Paste the manager customer ID, developer token, client ID, client secret and refresh token into Settings, Data provider keys, Google Ads.",
    ],
    caveat:
      "Without active ad spend Google rounds volume into coarse buckets rather than exact numbers. The ordering between keywords stays correct, which is what keyword research needs. Start Bing in parallel: it works the same hour, with no approval.",
  },
  {
    name: "Foundery (Azure AI)",
    url: "https://ai.azure.com/",
    cost: "Runs on your own Azure deployment",
    unlocks: "The in-app SEO agent, on your own deployment",
    minutes: "5 minutes",
    steps: [
      "Open your Azure AI Foundry resource and copy its endpoint, for example https://YOUR-RESOURCE.services.ai.azure.com",
      "Copy an API key from the resource's Keys and Endpoint page.",
      "Paste both into Settings, Data provider keys, Foundery. Add a deployment name after a pipe to override the default, for example ENDPOINT|growth-frontier",
    ],
    caveat:
      "Being precise: this runs on your own Azure deployment and draws on its quota. No charge reaches a card here, and it is the only sanctioned AI provider.",
  },
  {
    name: "Bing Webmaster Tools",
    url: "https://www.bing.com/webmasters/",
    cost: "Free forever, no card",
    unlocks: "Keyword volume and ideas, plus your real Bing positions",
    minutes: "5 minutes",
    steps: [
      "Sign in with a Microsoft account and add any site you own (verification is a DNS record or an HTML tag).",
      "Open Settings, then API access, then generate an API key.",
      "Paste it into Settings, Data provider keys, Bing Webmaster Tools.",
    ],
    caveat:
      "Volume is Bing volume, not Google. Use it to rank keywords against each other, not as absolute Google demand. It needs no approval, so it is the fastest way to a working install.",
  },
  {
    name: "PageSpeed Insights",
    url: "https://console.cloud.google.com/apis/credentials",
    cost: "Free, 25,000 requests a day",
    unlocks: "Lighthouse scores and Core Web Vitals in Site Audit",
    minutes: "3 minutes",
    steps: [
      "In Google Cloud Console create an API key and enable the PageSpeed Insights API.",
      "Set it as PAGESPEED_API_KEY in the server environment.",
    ],
    caveat:
      "A key is effectively required despite the docs calling it optional: unauthenticated calls share one anonymous quota that is routinely exhausted, and we measured a 429 on it.",
  },
  {
    name: "Google Search Console",
    url: "https://console.cloud.google.com/apis/credentials",
    cost: "Free, unlimited",
    unlocks: "Your real Google clicks, impressions, CTR and position",
    minutes: "10 minutes",
    steps: [
      "In Google Cloud Console create an OAuth 2.0 Client ID of type Web application.",
      "Add this app's callback URL as an authorised redirect URI.",
      "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment (.env for Docker), then restart. The OAuth flow reads the environment, not the Settings page.",
      "Connect your verified property from the GSC Insights page.",
    ],
    caveat:
      "This is the only source of true Google positions, and it covers domains you have verified. It is a census of every query that produced an impression, which is more complete than any paid tool's sample.",
  },
  {
    name: "OpenPageRank",
    url: "https://keywordseverywhere.com/",
    cost: "Free tier, 30,000 domains a month",
    unlocks:
      "Domain authority on Domain Overview, and the difficulty proxy shown against keywords",
    minutes: "10 minutes",
    steps: [
      "OpenPageRank no longer issues its own keys. Create a Keywords Everywhere account and generate an API key there.",
      "Sign in at openpagerank.keywordseverywhere.com with that Keywords Everywhere key to mint the OpenPageRank key.",
      "Paste the OpenPageRank key into Settings, Data provider keys, OpenPageRank.",
    ],
    caveat:
      "The difficulty number derived from this is an authority proxy, not a vendor difficulty score, and the app labels it that way wherever it appears. Without this key Domain Overview shows no authority column at all.",
  },
];

function FreeSetupHelpPage() {
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="card border border-base-300 bg-base-100">
          <div className="card-body gap-3">
            <h1 className="text-2xl font-semibold">
              Set up UpgradeSEO for free
            </h1>
            <p className="text-sm text-base-content/70">
              UpgradeSEO runs on free data sources. Connect the ones below and
              you get real Google keyword volume and CPC, Lighthouse scores,
              your actual Google positions, and an in-app AI agent, without
              paying anything or entering a card.
            </p>
            <p className="text-sm text-base-content/70">
              Site Audit and Competitors already work with no key at all.
            </p>
          </div>
        </div>

        {SOURCES.map((source, index) => (
          <div
            key={source.name}
            className="card border border-base-300 bg-base-100"
          >
            <div className="card-body gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="card-title text-base">
                  {index + 1}. {source.name}
                </h2>
                <span className="badge badge-success badge-sm gap-1">
                  <Check className="size-3" />
                  {source.cost}
                </span>
              </div>

              <p className="text-sm text-base-content/80">
                <span className="font-medium">Unlocks:</span> {source.unlocks}
                <span className="text-base-content/50">
                  {" "}
                  · {source.minutes}
                </span>
              </p>

              <ol className="list-decimal space-y-2 pl-5 text-sm text-base-content/80">
                {source.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              {source.caveat ? (
                // Stated up front rather than discovered later: a free stack
                // that oversells itself is worse than one that is honest.
                <p className="rounded bg-base-200 p-3 text-xs text-base-content/70">
                  {source.caveat}
                </p>
              ) : null}

              <div className="card-actions">
                <a
                  className="btn btn-sm btn-outline"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Get the key
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        ))}

        <div className="card border border-base-300 bg-base-100">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">How honest the numbers are</h2>
            <p className="text-sm text-base-content/70">
              Nothing here needs a paid vendor. Where a free source is a proxy
              rather than an exact match, the app says so on the number itself
              instead of quietly presenting an estimate as a measurement.
            </p>
          </div>
        </div>

        <div className="card border border-base-300 bg-base-100">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Where keys go</h2>
            <p className="text-sm text-base-content/70">
              Every key above is entered in the app, not in a config file. They
              are encrypted before storage and are never shown again.
            </p>
            <div className="card-actions">
              <Link className="btn btn-primary btn-sm" to="/settings">
                Open Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
