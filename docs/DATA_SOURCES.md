# Data sources — setup and honest limits

UpgradeSEO uses only free data sources. Each one is optional; the app degrades
honestly rather than inventing numbers — a `—` with a reason, never a zero.
Keys go in **Settings → Data provider keys** (encrypted at rest) or the
matching environment variable for server-managed deployments.

## Works with no key at all

| Feature       | Source                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| Keyword ideas | Google Autocomplete (real Google queries; **no volume/CPC by design**) |
| Site Audit    | your own crawler + keyless PageSpeed (an API key raises the quota)     |
| Competitors   | Common Crawl (no requests ever hit the competitor's site)              |

## Key-backed sources

### Microsoft Advertising — `MICROSOFT_ADS_CREDENTIALS` + `MICROSOFT_ADS_ACCOUNT`

Real search volume, CPC and competition, first in the volume precedence because
its developer token is self-service (Settings → Developer settings in the Ads
UI). **The account you authorize must be a real Microsoft identity** — an Ads
login created via "Sign in with Google" cannot mint API tokens; see
DEPLOYMENT_TRAPS.md. Credentials JSON: `developerToken` plus either a
`refreshToken`+`clientId` pair (long-lived, preferred) or a bare `accessToken`
(dies within the hour). Account field: `customerId|accountId`. Volumes are
Microsoft/Bing demand, not Google's — ordering holds, absolutes run lower.

### Google Ads — `GOOGLE_ADS_CREDENTIALS` + `GOOGLE_ADS_CUSTOMER_ID`

Google's own volume and CPC. Requires Basic Access, a manual review Google
routinely refuses to small accounts — which is why it is not the default path.

### Bing Webmaster — `BING_WEBMASTER_API_KEY`

Keyword impressions (a volume proxy), your Bing positions, and backlinks for
verified sites. Free, instant. Its related-keywords corpus is consumer search:
the app filters results against your seed's own words, and Google Autocomplete
tops up whatever it cannot answer.

### OpenPageRank — `OPENPAGERANK_API_KEY`

Domain authority 0–10 for any domain, used for the difficulty proxy. Built on
Common Crawl's web graph, so a site that blocks `CCBot` in robots.txt will
show no score — including, possibly, your own.

### Foundery (any OpenAI-compatible endpoint) — `FOUNDERY_API_KEY` + `FOUNDERY_ENDPOINT`

Runs Brand Lookup and Prompt Explorer on your own model deployment instead of
a paid vendor. Endpoint format: `https://RESOURCE.host` or
`https://RESOURCE.host|DEPLOYMENT`. Reasoning models that reject `max_tokens`
are handled (the client renames it to `max_completion_tokens`). Answers come
from one model without web search and are labelled as such in the UI.

### Bright Data SERP — `BRIGHTDATA_API_TOKEN` + `BRIGHTDATA_ZONE`

Optional, off by default: live Google positions for domains you have not
verified. Scraped, not licensed — the UI says so. Trial zones return ~10
results; a "Google SERP scraper" zone returns up to 100.

### Google Search Console / GA4 — OAuth, not keys

Your own clicks, impressions, positions (GSC) and organic sessions, engagement,
key events (GA4). Self-hosted mode uses your own OAuth client
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`); see
SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md and SELF_HOSTING_GOOGLE_ANALYTICS.md.
A new GA4 property reports nothing for its first 24–48h — expected, not broken.

## What no free source provides

Keyword difficulty (vendor-style), search intent, competitor SERP occupants,
third-party traffic estimates, dofollow ratios, lost-link history. These render
as `—` with the reason, and always will until a real source exists.
