# Deployment traps — field notes

Every entry here cost real diagnosis time on a live deployment. Each one lists
the symptom first, because that is what you will actually see.

## Wrangler deploys a GENERATED config

**Symptom:** you edit `wrangler.jsonc` (bindings, vars, routes) and the deploy
ignores it.

The Cloudflare Vite plugin writes `dist/server/wrangler.json` at build time and
`wrangler deploy` uses that ("Using redirected Wrangler configuration"). Edits
to `wrangler.jsonc` take effect only after the next `vite build`. Always
rebuild before deploying config changes.

## Fork bindings point at someone else's resources

**Symptom:** deploy fails with `KV namespace '…' not found` — or worse,
succeeds against the wrong account's resources.

The D1/KV ids in a forked `wrangler.jsonc` belong to the upstream author.
Create your own (`wrangler d1 create`, `wrangler kv namespace create`) and
replace every id before the first deploy.

## R2 must be enabled in the dashboard first

`wrangler r2 bucket create` fails with `code: 10042` until R2 is switched on in
the Cloudflare dashboard, which requires accepting terms and a payment method
on file (the free tier still applies).

## Workers Free: 5 cron triggers PER ACCOUNT

**Symptom:** `Some triggers failed to deploy` / "non-user error" on
`PUT .../schedules`, identical for one cron or ten, with no mention of a quota
anywhere in wrangler's output. Only the dashboard states the real reason.

The cap is account-wide across all workers, not per worker. Free a slot,
upgrade to Workers Paid, or run without schedules (everything on-demand still
works; scheduled rank checks and the stale-audit watchdog do not).

## GA4: a brand-new property answers with an empty object

**Symptom:** Analytics connects fine, then every report call fails.

Until daily processing produces data (24–48h after creation), the Data API can
return `{}` — no headers, no rows. The normalizer treats that as an empty
report (`Ga4ReportNormalization.ts`); if you ever see
`Google Analytics returned an invalid report`, the worker log now prints which
side of the header comparison disagreed.

## `GA4_OAUTH_APP_PENDING` hides the entire GA4 connect surface

**Symptom:** in hosted mode the Analytics section renders as a heading with
nothing under it — no card, no error.

`src/shared/ga4.ts` ships this flag from upstream. Set it `false` once your own
OAuth app exists; users see Google's "unverified app" interstitial until scope
verification, but the flow works.

## Ad blockers make Google Analytics look broken

**Symptom:** the site owner reports GA "shows 0"; `gtag/js` returns 204.

Privacy extensions block the tag for exactly the person most likely to check
it. Verify in a clean/incognito profile, and remember Realtime is the only
report that reflects the last few minutes.

## Microsoft Advertising: Google-federated sign-ins have no Microsoft identity

**Symptom:** OAuth for the Bing Ads API fails with "We couldn't find a
Microsoft account", even though ads.microsoft.com is signed in.

Ads accepts Google sign-in as an Ads-only identity. The API needs a real
Microsoft account (MSA or Entra) — create one for the same email, or invite an
existing Microsoft identity to the Ads account and authorize as that user.

## Egress IP surprises

IP-locked API tokens and OAuth flows both misbehave behind rotating VPN exits:
Cloudflare answers `Cannot use the access token from location`, and transient
`fetch failed` from wrangler is usually the tunnel, not Cloudflare.
