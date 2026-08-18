---
title: "Docker Self-Hosting"
description: "Run UpgradeSEO locally with Docker Compose using the published GHCR image."
---

Run UpgradeSEO locally with Docker.

In Docker mode, UpgradeSEO uses `AUTH_MODE=local_noauth` (no auth checks, local admin user `admin@localhost`). Only expose it behind your own auth-protected reverse proxy, tunnel, or private network. For internet-facing self-hosting, use [Cloudflare](/docs/self-hosting/cloudflare) instead.

The default `compose.yaml` uses the published GHCR image:

- `ghcr.io/YOUR_GITHUB_ORG/upgradeseo:latest`

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose)
UpgradeSEO runs on free data sources: Google Ads for real Google volume and CPC, Bing Webmaster, Azure AI Foundry for the in-app agent, and PageSpeed Insights. Set them up from /help/free-setup in the running app.

## Quickstart

Clone the repo, then:

```bash
git clone 
cd upgradeseo
cp .env.example .env
```


```bash
docker compose up -d
```

Open `http://localhost:<PORT>` (default `3001`). Each container start builds the app and may take 1-2 minutes; follow progress with `docker compose logs -f`.

Optional env values:

- `PORT` (defaults to `3001`)
- `ALLOWED_HOST` (single reverse-proxy hostname to allow in Vite preview)
- `AUTH_MODE=local_noauth` (already set in compose)
- `UPGRADESEO_IMAGE` (defaults to `ghcr.io/YOUR_GITHUB_ORG/upgradeseo:latest`)

If you are putting Docker behind a reverse proxy or a temporary tunnel, remember that Docker self-hosting runs with app auth disabled. Only expose it behind your own auth-protected reverse proxy, tunnel, or private network, and add the public hostname before restarting:

```bash
ALLOWED_HOST=yourdomain.com docker compose up -d
```

You can also persist it in `.env`.

## Telemetry

UpgradeSEO collects anonymized telemetry for core usage events: heartbeats with aggregate counts (installs, users, projects, feature usage) tied to a random install ID, sent every 5 minutes during the first two hours after install, then at most once daily. Telemetry also includes failed setup check names and statuses, never values or error messages. No URLs, keywords, prompts, emails, or IP-derived location are collected, and idle installs send nothing.

To disable it, set `UPGRADESEO_TELEMETRY_DISABLED=1` (or `DO_NOT_TRACK=1`) in `.env`, then run `docker compose up -d --force-recreate upgradeseo`.

## Pin to a specific image tag

Set `UPGRADESEO_IMAGE` in `.env` and restart:

```bash
UPGRADESEO_IMAGE=ghcr.io/YOUR_GITHUB_ORG/upgradeseo:v1.2.3
docker compose up -d
```

## Build your own image locally

If you are testing local code changes, build and run a local tag:

```bash
docker build -f Dockerfile.selfhost -t upgradeseo:local .
UPGRADESEO_IMAGE=upgradeseo:local docker compose up -d
```

## Common commands

Restart service after env changes:

```bash
docker compose up -d upgradeseo
```

Pull latest published image and restart:

```bash
docker compose pull && docker compose up -d
```

Stop:

```bash
docker compose down
```

## Health and troubleshooting

Startup checks appear in `docker compose logs` before the build. Once running, `/api/health` reports configuration and database status, and `docker compose ps` reports container health.

## Troubleshooting environment variables

To confirm Docker Compose is using the expected environment variables:

```bash
docker compose config
```


If you changed `.env`, recreate the container so Compose reapplies it:

```bash
docker compose up -d --force-recreate upgradeseo
```
