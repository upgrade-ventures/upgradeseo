---
title: "Self-Hosting UpgradeSEO"
UpgradeSEO runs on free data sources: Google Ads for real Google volume and CPC, Bing Webmaster, Azure AI Foundry for the in-app agent, and PageSpeed Insights. Set them up from /help/free-setup in the running app.
---


There are two self-hosting paths:

- **Simple: [Docker](/docs/self-hosting/docker)**, recommended for personal use on your own machine. Easiest way to get started.
- **Advanced: [Cloudflare](/docs/self-hosting/cloudflare)**, for internet-facing self-hosting across multiple devices or with your team. A SaaS-like experience with automatic database backups, and it works on Cloudflare's free plan. Slightly more setup if you're unfamiliar with Cloudflare.



2. Click "Send by email" to get your credentials.
3. Copy the longer credentials labelled "Base64" credentials.
   - Docker: `.env`
   - Cloudflare: as a Worker secret in the dashboard
   - Local development: `.env.local`


## Optional features

### Google Search Console

Search Console is optional and works in self-hosted deployments using your own Google OAuth client. It takes about 10 minutes of one-time setup. See the [Google Search Console guide on GitHub]().

### AI features (SAM)

AI features like SAM, the in-app SEO agent, are optional. Set the `OPENROUTER_API_KEY` environment variable to enable them. Create a key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
