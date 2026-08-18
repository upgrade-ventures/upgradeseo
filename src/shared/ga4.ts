/** Better Auth provider ID for the dedicated Google Analytics grant. */
export const GA4_OAUTH_PROVIDER_ID = "google-analytics";

// Gates every hosted GA4 connect surface. Upstream shipped this as `true`
// while their OAuth app awaited Google verification, which silently renders
// the Analytics card as an EMPTY section in hosted mode — a heading with
// nothing under it and no error anywhere. This deployment runs its own OAuth
// app, published 2026-08-18: users see Google's "unverified app" interstitial
// (Advanced → continue) until verification completes, but the flow works, so
// the surface stays visible.
export const GA4_OAUTH_APP_PENDING = false;

export const GA4_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

export const GA4_SELF_HOSTED_SETUP_DOCS_URL = "";
