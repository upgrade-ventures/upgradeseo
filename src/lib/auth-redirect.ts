import { withBasePath } from "@/shared/base-path";
const OAUTH_AUTHORIZE_PATH = "/api/auth/oauth2/authorize";
const OAUTH_SIGNED_QUERY_END = "sig";
const OAUTH_AUTHORIZE_MARKERS = ["response_type", "client_id", "redirect_uri"];

/**
 * The app's own home, which is NOT "/" on a sub-path deploy.
 *
 * "/" is the origin root, and on upgrade.ventures that is the Ghost marketing
 * site. Returning it as the post-login destination signs a user in correctly
 * and then throws them out of the product — the session is fine, the landing
 * is just somebody else's page.
 */
const APP_HOME = withBasePath("/");

export function normalizeAuthRedirect(value: string | null | undefined) {
  // Backslashes are rejected because URL parsers treat them as slashes:
  // "/\evil.com" resolves cross-origin, an open redirect via
  // window.location sinks.
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return APP_HOME;
  }

  return value;
}

export function getOAuthSignedQuery(search: string | null | undefined) {
  if (!search) return null;

  const params = new URLSearchParams(search);
  if (
    !params.has(OAUTH_SIGNED_QUERY_END) ||
    !OAUTH_AUTHORIZE_MARKERS.every((marker) => params.has(marker))
  ) {
    return null;
  }

  // Better Auth signs the authorize params it appends to `loginPage`.
  // Preserve only the signed segment through `sig`; any later params belong to
  // the app page URL and must not be folded into the OAuth continuation.
  const signedParams = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    signedParams.append(key, value);
    if (key === OAUTH_SIGNED_QUERY_END) break;
  }

  return signedParams.toString();
}

export function getOAuthAuthorizeRedirectFromSearch(
  search: string | null | undefined,
) {
  const signedQuery = getOAuthSignedQuery(search);
  return signedQuery ? `${OAUTH_AUTHORIZE_PATH}?${signedQuery}` : null;
}

export function getAuthRedirectFromSearch(
  search: string | null | undefined,
  redirect: string | null | undefined,
) {
  return (
    getOAuthAuthorizeRedirectFromSearch(search) ??
    normalizeAuthRedirect(redirect)
  );
}

export function getCurrentAuthRedirect(
  redirect: string | null | undefined,
  location: Pick<Location, "search"> | null | undefined = typeof window !==
  "undefined"
    ? window.location
    : null,
) {
  return getAuthRedirectFromSearch(location?.search, redirect);
}

export function getCurrentAuthRedirectFromHref(href: string) {
  const url = new URL(href, "https://upgradeseo.local");
  return normalizeAuthRedirect(`${url.pathname}${url.search}${url.hash}`);
}

export function getSignInSearch(redirectTo: string) {
  return redirectTo === APP_HOME ? {} : { redirect: redirectTo };
}

export function getVerifyEmailSearch(
  email: string | undefined,
  redirectTo: string,
) {
  const search: { email?: string; redirect?: string } = {};
  if (email) search.email = email;
  if (redirectTo !== APP_HOME) search.redirect = redirectTo;
  return search;
}

export function getSignInHref(redirectTo: string) {
  const search = getSignInSearch(redirectTo);
  if (!("redirect" in search)) {
    return withBasePath("/sign-in");
  }

  return `${withBasePath("/sign-in")}?redirect=${encodeURIComponent(
    search.redirect ?? APP_HOME,
  )}`;
}

export function getSignInHrefForLocation(location: {
  pathname: string;
  search: string;
  hash?: string;
}) {
  return getSignInHref(
    normalizeAuthRedirect(
      `${location.pathname}${location.search}${location.hash ?? ""}`,
    ),
  );
}
