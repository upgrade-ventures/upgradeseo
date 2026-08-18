# UpgradeSEO — free, open-source SEO tools you self-host

> Keyword research, rank tracking, backlinks, site audit and AI visibility.
> No subscription, no seat pricing, and no paid data API required.

**[Try the live demo](https://upgrade.ventures/UpgradeSEO)** · sign in with
Google, no card, nothing to install.

UpgradeSEO is a self-hosted alternative to Semrush and Ahrefs. It runs on data
sources that cost nothing per call, so there is no meter and nothing to bill:
Google Search Console and Google Analytics for your own site, Google
Autocomplete for keyword ideas, Bing Webmaster and OpenPageRank for volume and
authority, Common Crawl for competitor pages.

**Bring your own free keys and the bill is zero.** That is the whole point, and
it is the one thing this fork changes about the project it came from: the
upstream needs a paid DataForSEO key to answer a keyword query, and this does
not.

> All-in-one SEO tool for you and your AI agent.

Connect any MCP client — Claude Code, Claude Desktop, Codex — and it can run
keyword research, SERP checks, domain lookups, backlinks and site audits mid
conversation. Pre-built skills ship with the repo, and you can write your own.

## What it does

|                  | Runs on                                                   | Costs                         |
| ---------------- | --------------------------------------------------------- | ----------------------------- |
| Keyword research | Google Autocomplete, Bing Webmaster, Microsoft/Google Ads | free, no key needed for ideas |
| Rank tracking    | your own Search Console, optional SERP provider           | free                          |
| Site audit       | our own crawler, PageSpeed Insights                       | free                          |
| Backlinks        | Bing Webmaster, OpenPageRank                              | free                          |
| Competitors      | Common Crawl                                              | free, no key                  |
| AI visibility    | your own Azure AI Foundry deployment                      | your Azure credit             |

Numbers no free source can supply are shown as "no data", never as zero. A dash
here means nobody measured it, not that the answer is nothing.

## Why use UpgradeSEO?

- Genuinely free. No subscription, no per-call charge, no card on file.
- Best in class MCP and AI skills.
- Modern, focused UI instead of a bloated suite.
- Self-hosted: your keys, your data, your infrastructure.
- Fork it and build your own tool.

## Main SEO Workflows

- Keyword research
- Rank tracking
- Competitor Insights
- Backlinks
- Site Audits
- AI Visibility

## UpgradeSEO MCP & Agent Skills

UpgradeSEO exposes an MCP server so AI agents like Claude Code, OpenClaw, and Hermes can use your SEO data directly. Agent Skills are reusable workflows that guide your agent through SEO tasks using the MCP.

- [Set up UpgradeSEO MCP]()
- [Set up UpgradeSEO Agent Skills]()

## Self-Hosting

UpgradeSEO supports two self-hosting paths:

- **Simple: Docker** for personal use on your own machine (recommended for getting started). See [`docs/SELF_HOSTING_DOCKER.md`](./docs/SELF_HOSTING_DOCKER.md).
- **Advanced: Cloudflare** for internet-facing self-hosting across multiple devices or with your team (works on the free plan). See [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md).

## Costs

UpgradeSEO itself is free: bring your own free-tier keys (Search Console,
Bing Webmaster, OpenPageRank, an ads API for volume) and pay nothing per
call. What each source provides and refuses to fake is documented in
[`docs/DATA_SOURCES.md`](./docs/DATA_SOURCES.md).

## Local Development

See [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md).

## Contributing

Creating clear issues is the best way to contribute.

Read more here: [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md)

We have this skill: `/simple-issue-description` which helps.

```sh
npx skills add YOUR_GITHUB_ORG/upgradeseo --skill simple-issue-description
```

## Community

Questions or feedback: [support@upgrade.ventures](mailto:support@upgrade.ventures)

Follow along for updates:

- Follow on X: https://x.com/UpgradeVentures
- Live demo: https://upgrade.ventures/UpgradeSEO

## License

MIT for the code. The name and logo are Upgrade Ventures trademarks — see
[TRADEMARK.md](./TRADEMARK.md). Fork it freely; rename it if you ship it.
