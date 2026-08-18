# Hosted auth mode (public demo with sign-in)

**Self-hosters do not need any of this.** The default modes —
`cloudflare_access` (login gate at the edge) and `local_noauth` (no auth,
trusted network) — require no Google OAuth client and no registration feature.
This page covers `AUTH_MODE=hosted` only: the mode behind a public demo where
strangers sign in with Google or email, as at
`upgrade.ventures/UpgradeSEO`.

## Requirements

| Setting                                            | Notes                                                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_MODE=hosted`                                 | in BOTH the build env and the worker vars — the client bakes it at build time (`isHostedClientAuthMode`)                      |
| `BETTER_AUTH_URL`                                  | the **origin only**, e.g. `https://example.com`. On a sub-path deploy the prefix comes from `basePath`, never from this value |
| `BETTER_AUTH_SECRET`                               | ≥ 32 chars                                                                                                                    |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`        | a web OAuth client with the redirect URIs listed in SUBPATH_DEPLOYMENT.md                                                     |
| `BYPASS_EMAIL_VERIFICATION=true` **or** Loops keys | email/password signup verifies addresses via Loops; the bypass skips it (build env AND runtime, or route guards loop)         |
| Turnstile keys                                     | optional captcha; enforced only when the server secret is set                                                                 |

`hasHostedAuthConfig()` in `src/lib/auth.ts` is the authoritative checklist —
if sign-in reports itself unavailable, that function is why.

## Google consent screen realities

- Publish the OAuth app ("In production") or only listed test users can sign
  in at all. The project owner always slips through, which makes half-broken
  configs look healthy.
- GSC/GA4 use sensitive scopes: until Google verification (weeks), users see
  the "unverified app" interstitial and proceed via **Advanced**. Plain
  sign-in shows no warning.
- Unverified sensitive scopes carry a **100-user lifetime cap** that cannot be
  reset.
- Set `GA4_OAUTH_APP_PENDING` in `src/shared/ga4.ts` to `false` once your own
  OAuth app exists, or the GA4 connect surface renders as an empty section.

## Sign-in surface

`/sign-in` and `/sign-up` (Google + email), account menu in the shell header,
post-login redirect to the app home — all basepath-aware. The reporting-side
GSC/GA4 connections made by users store per-project OAuth grants through
Better Auth's generic OAuth plugin (`google-search-console`,
`google-analytics` provider IDs).
