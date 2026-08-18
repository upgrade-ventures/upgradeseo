import { createFileRoute } from "@tanstack/react-router";
import { buildPageSeo } from "@/lib/seo";

/**
 * There is no pricing model any more.
 *
 * This page used to be a per-call cost estimator: a table of provider prices
 * with a 1.28 markup on top, plus a credit balance. Every one of those numbers
 * came from a metered data vendor that has been removed. UpgradeSEO now runs on
 * free sources, so there is no per-call cost to mark up and no credit to meter.
 *
 * Rather than leave an estimator that computes zero, the page says what is
 * actually true and points at the setup guide.
 */
export const Route = createFileRoute("/_marketing/pricing")({
  head: () =>
    buildPageSeo({
      title: "Pricing",
      description:
        "UpgradeSEO is free. It runs on free data sources, so there are no per-call costs, no credits, and no plan tiers.",
      path: "/pricing",
    }),
  component: PricingPage,
});

const SOURCES = [
  {
    name: "Microsoft Advertising",
    gives: "Real search volume, CPC and 12 months of seasonality",
    cost: "Free. Self-service token, no approval, no ad spend required.",
  },
  {
    name: "Google Search Console",
    gives: "Your real Google clicks, impressions, CTR and position",
    cost: "Free and unlimited, for domains you have verified.",
  },
  {
    name: "Bing Webmaster Tools",
    gives: "Keyword demand and your Bing positions",
    cost: "Free forever, no card.",
  },
  {
    name: "Common Crawl",
    gives: "Competitor page inventories and link data",
    cost: "Free. Open data, no account.",
  },
  {
    name: "PageSpeed Insights",
    gives: "Lighthouse scores and Core Web Vitals",
    cost: "Free, 25,000 requests a day.",
  },
  {
    name: "Azure AI Foundry",
    gives: "The in-app SEO agent",
    cost: "Runs on your own Azure deployment.",
  },
];

function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">
        UpgradeSEO is free
      </h1>
      <p className="mt-4 text-lg text-base-content/70">
        Not free-tier, not free-for-now, not credits that run out. The app runs
        on data sources that do not charge per call, so there is nothing to
        meter and nothing to bill.
      </p>
      <p className="mt-3 text-base-content/70">
        You connect your own keys, so the quotas are yours and the data never
        passes through anyone else&apos;s account. Self-host it and the whole
        thing runs on your infrastructure.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">Where the data comes from</h2>
      <div className="mt-6 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Source</th>
              <th>What it gives you</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((source) => (
              <tr key={source.name}>
                <td className="font-medium">{source.name}</td>
                <td className="text-base-content/70">{source.gives}</td>
                <td className="text-base-content/70">{source.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-2xl font-semibold">What free does not buy</h2>
      <p className="mt-4 text-base-content/70">
        Being straight about the ceiling rather than discovering it later. Live
        Google rankings for a domain you have not verified need a source that
        scrapes Google, which no free licensed API does. UpgradeSEO ships that as
        an opt-in integration you enable yourself, clearly labelled as scraped
        rather than licensed, and it is off by default.
      </p>
      <p className="mt-3 text-base-content/70">
        Everything else, including keyword research, competitor analysis, site
        audits, Core Web Vitals and your own rankings, works with no payment of
        any kind.
      </p>
    </div>
  );
}
