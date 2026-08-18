/**
 * The path this app is mounted at, and the single place that knows it.
 *
 * upgrade.ventures serves Ghost at the root, so this app is routed at a
 * sub-path instead of its own hostname. That is a deliberate choice and it has
 * one consequence worth stating plainly: an app mounted below root has to
 * prefix every absolute path it emits, not just its page routes.
 *
 * WHAT READS THIS, and what breaks without it:
 *   - the TanStack router basepath ......... links resolve to Ghost's routes
 *   - Vite's `base` ........................ every asset 404s
 *   - the Google OAuth callback paths ...... Google calls back to Ghost, and
 *                                            Search Console silently never
 *                                            connects
 *   - the MCP route ........................ agents get Ghost's 404 page
 *
 * The empty default keeps local dev, Docker self-host and the workers.dev
 * preview at root, where they have their own hostname and no prefix is wanted.
 * Set BASE_PATH at build time for a sub-path deploy.
 *
 * Always stored without a trailing slash so `${BASE_PATH}/x` never doubles up.
 */
/**
 * "UpgradeSEO", "/UpgradeSEO/", " /UpgradeSEO " and "" must all normalize the
 * same way, because this value is typed by hand into an env file. Pure so the
 * whole basepath contract is testable without touching import.meta.
 */
export function normalizeBasePath(raw: string | undefined): "" | `/${string}` {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "" || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

/**
 * Strip the mount prefix from an /api/* path so Start's file routes match.
 *
 * The auth exception is deliberate: Better Auth carries its own prefixed
 * basePath (see lib/auth.ts) and matches on the UNSTRIPPED path. Every other
 * server route is registered at its literal, unprefixed path.
 */
export function stripApiBasePath(
  pathname: string,
  basePath: "" | `/${string}`,
): string {
  if (!basePath) return pathname;
  if (!pathname.startsWith(`${basePath}/api/`)) return pathname;
  if (pathname.startsWith(`${basePath}/api/auth/`)) return pathname;
  return pathname.slice(basePath.length);
}

/**
 * Typed as a union rather than `string` so `withBasePath` can promise a
 * leading slash. Callers like the OAuth integration type their path as
 * `/${string}` and would otherwise reject a plain string.
 */
export const BASE_PATH: "" | `/${string}` = normalizeBasePath(
  import.meta.env?.VITE_BASE_PATH,
);

/** Prefix an app-absolute path. `withBasePath("/mcp")` → "/UpgradeSEO/mcp". */
export function withBasePath(path: `/${string}`): `/${string}` {
  return BASE_PATH === "" ? path : `${BASE_PATH}${path}`;
}
