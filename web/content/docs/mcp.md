---
title: "Set up UpgradeSEO MCP"
description: "Connect UpgradeSEO MCP to Claude, Codex, and other AI clients."
---

UpgradeSEO MCP lets compatible AI clients call UpgradeSEO tools for keyword research, SERP inspection, local business research, competitive search intelligence, domain research, backlink overview, saved keywords, rank tracking, and Google Search Console performance and URL inspection.

The hosted MCP server URL is:

```txt

```

The first connection sends you through UpgradeSEO login. After authorization, your MCP client can call UpgradeSEO tools with the project context and account scopes you approved. For headless environments and CI, [connect with an API key](#connect-with-an-api-key) instead.

For the most current setup UI and a copyable endpoint, open [AI & MCP in UpgradeSEO]().

## Claude Code

Use user scope to make UpgradeSEO available across projects. Use local scope for the current repository.

```bash
claude mcp add --transport http --scope user upgradeseo 
```

After adding the server, approve the UpgradeSEO login when prompted.

## Claude Desktop

1. Open Settings -> Connectors.
2. Click Add custom connector.
3. Paste ``.
4. Approve the UpgradeSEO login when prompted.

Claude Desktop custom connectors require a Claude plan that supports custom connectors.

## Cursor

1. Open Cursor Settings -> Tools & Integrations -> MCP Tools.
2. Click New MCP Server. Cursor opens `mcp.json`.
3. Add:

```json
{
  "mcpServers": {
    "upgradeseo": {
      "url": ""
    }
  }
}
```

4. Approve the UpgradeSEO login when prompted.

## Codex CLI

Run this in your terminal:

```bash
codex mcp add upgradeseo --url 
```

Approve the login when prompted.

## Codex Desktop

1. Open Settings -> Integrations & MCP.
2. Click Add your own.
3. Paste ``.
4. Approve the UpgradeSEO login when prompted.

## Connect with an API key

Use an API key in headless environments, CI, or clients where OAuth is inconvenient. API keys are personal: anything an agent does with your key acts as you in your workspace.

In the [UpgradeSEO app](), open **Settings -> API keys**, create a key, and copy it when it appears. It won't be shown again.

For Claude Code, run:

```bash
claude mcp add --transport http --scope user upgradeseo  --header "Authorization: Bearer oseo_YOUR_KEY"
```

For Cursor, add `headers` to the server entry in `mcp.json`:

```json
{
  "mcpServers": {
    "upgradeseo": {
      "url": "",
      "headers": {
        "Authorization": "Bearer oseo_YOUR_KEY"
      }
    }
  }
}
```

For Codex CLI, put the key in an environment variable and reference it:

```bash
export UPGRADESEO_API_KEY=oseo_YOUR_KEY
codex mcp add upgradeseo --url  --bearer-token-env-var UPGRADESEO_API_KEY
```

Any other client that supports custom HTTP headers can send `Authorization: Bearer oseo_YOUR_KEY` or `x-api-key: oseo_YOUR_KEY`.

## Available tools

UpgradeSEO MCP exposes tools for SEO research workflows:

- Research keywords with volume, difficulty, and CPC.
- Fetch live Google organic SERP results for keywords.
- Find exact keyword, page, rank, volume, CPC, intent, and traffic rows for a domain or page.
- Compare SERP competitors across a supplied keyword set.
- Search local businesses near a coordinate, fetch one Maps or Local Finder SERP, and read Google Business Q&A when needed.
- Hydrate keywords with search volume, difficulty, intent, CPC, and trends.
- List saved keywords from an UpgradeSEO project.
- Save useful keywords back to UpgradeSEO.
- Read rank tracker configs and latest keyword positions.
- Summarize a domain's organic footprint.
- Find keywords a domain already ranks for.
- Check backlink and referring-domain overview data.
- Read first-party Google Search Console performance (clicks, impressions, CTR, position).
- Inspect index status, crawl, and canonical for specific URLs (up to 10 per call).

## What to do after setup

Once UpgradeSEO MCP is connected, [set up UpgradeSEO Agent Skills](/docs/skills/setup). MCP gives your agent access to UpgradeSEO data. Skills are separate `SKILL.md` files that tell your agent how to use that data for specific SEO jobs.

Start with one focused workflow instead of asking your agent to "do SEO" broadly.

- Use [SEO project setup](/docs/skills/seo-project-setup) to capture your SEO goals and website context in a local workspace.
- Use [SEO coach](/docs/skills/seo-coach) if you are new to SEO or are not sure which workflow to run first.
- Use [keyword research](/docs/skills/keyword-research) to discover keyword opportunities.
- Use [competitive landscape](/docs/skills/competitive-landscape) to map a market before choosing competitors or pages.
- Use [competitor analysis](/docs/skills/competitor-analysis) to study one competitor.
- Use [keyword clustering](/docs/skills/keyword-clustering) to turn keywords into page groups.
- Use [link prospecting](/docs/skills/link-prospecting) to find outreach prospects for a linkable asset.

## Troubleshooting

If your client cannot connect, check that the server URL is exactly ``.

If authorization fails, disconnect the UpgradeSEO server in your client, add it again, and repeat the login flow.

If your agent cannot find a project, ask it to list UpgradeSEO projects first and use the returned project ID in later tool calls.
