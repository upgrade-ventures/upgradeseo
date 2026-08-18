# Deploying under a sub-path

UpgradeSEO normally owns its hostname. It can also be mounted below another
site — the reference deployment serves Ghost at `upgrade.ventures/` and this
app at `upgrade.ventures/UpgradeSEO/`. That one decision touches more places
than you expect, and every one of them fails silently when missed. This page is
the complete contract.

## The one input

```
VITE_BASE_PATH=UpgradeSEO   # build-time, in .env — not a runtime variable
```

Empty (the default) means a root mount; nothing below applies. The value is
normalized by `src/shared/base-path.ts` (`"UpgradeSEO"`, `"/UpgradeSEO/"`,
`" /UpgradeSEO "` all work), and that module is the single source of truth:
every other file imports `BASE_PATH` / `withBasePath` from it.

## What reads it, and how each one fails without it

| Consumer                                                       | Failure when missed                                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tanstackStart({ router: { basepath } })` in `vite.config.ts`  | every asset URL unprefixed → 404 into the host site                                                                                                                                  |
| `base-path:relocate-assets` plugin (same file)                 | URLs prefixed but files at `dist/client/assets/` → Workers Assets misses, the worker answers with the SPA shell as `text/html`, and the page renders **blank with no console error** |
| Router `basepath` (`src/router.tsx`)                           | links resolve to the host site's routes                                                                                                                                              |
| Better Auth server `basePath` (`src/lib/auth.ts`)              | every `/api/auth/*` endpoint 404s with an empty body; the UI symptom is "Google sign in is not available right now"                                                                  |
| Better Auth client `basePath` (`src/lib/auth-client.ts`)       | session lookups hit the host site and never settle → blank auth pages                                                                                                                |
| `stripApiBasePath` in `src/server.ts`                          | non-auth `/api/*` routes 404 (Start prefixes page routes only, never file server routes)                                                                                             |
| OAuth callback paths (`selfHostedOAuth.ts`)                    | Google redirects to the host site after consent                                                                                                                                      |
| Post-login redirect (`src/lib/auth-redirect.ts`)               | sign-in succeeds, then lands on the host site's homepage                                                                                                                             |
| `robots.txt` + `withBasePath("/favicon.svg")`-style asset refs | crawler rules unserved; broken images                                                                                                                                                |

`BETTER_AUTH_URL` must be the **origin only** (`https://example.com`), never
origin+prefix — the prefix lives in `basePath` alone, or the two compound into
`/UpgradeSEO/UpgradeSEO/api/auth`.

## OAuth redirect URIs to register

For a mount at `https://HOST/PREFIX` with hosted Google auth, the client needs
all of:

```
https://HOST/PREFIX/api/auth/callback/google
https://HOST/PREFIX/api/auth/oauth2/callback/google-search-console
https://HOST/PREFIX/api/auth/oauth2/callback/google-analytics
https://HOST/PREFIX/api/gsc/oauth/callback     (self-hosted-mode flow)
https://HOST/PREFIX/api/ga4/oauth/callback     (self-hosted-mode flow)
```

The `oauth2/callback/*` pair is easy to miss: those are Better Auth's
generic-OAuth paths, used by the hosted GSC/GA4 connect flows, and nothing
errors until a user completes consent and lands on `redirect_uri_mismatch`.

## Verifying

```
npm run verify:basepath
```

Builds with the prefix and asserts files and emitted URLs agree, in both
directions (missing prefix and doubled prefix). `src/shared/base-path.test.ts`
pins the path logic. Neither check can catch a _new_ absolute path added in a
component — grep for `src="/` and `href="/` when touching UI that references
static assets.
