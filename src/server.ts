import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { runScheduledRankChecks } from "@/server/features/rank-tracking/services/scheduledRankChecks";
import { reconcileStaleAudits } from "@/server/features/audit/services/auditReconciler";
import { getAuthMode, isHostedAuthMode } from "@/lib/auth-mode";
import {
  createUpgradeSeoOAuthProvider,
  type UpgradeSeoOAuthEnv,
} from "@/server/mcp/oauth-provider";
import { requestWithPublicOrigin } from "@/server/mcp/public-origin";
import { MCP_ROUTE } from "@/server/mcp/context";
import { handleSelfHostedUpgradeSeoMcpRequest } from "@/server/mcp/transport";
import { withPgClient } from "@/db";
import { maybeSendSelfHostHeartbeat } from "@/server/lib/self-host-telemetry";
import { handleGdprStorageErasure } from "@/server/gdpr/storage-erasure";
import { GDPR_STORAGE_ERASURE_PATH } from "@/shared/gdpr-erasure";
import { BASE_PATH, stripApiBasePath, withBasePath } from "@/shared/base-path";

const appFetch = createStartHandler(defaultStreamHandler);
const upgradeSeoOAuthProvider = createUpgradeSeoOAuthProvider(appFetch);

// Authorize an onboarding-chat connection in the Worker, before it reaches the
// Durable Object. The DO instance name is the projectId (set client-side); we
// resolve the session here and confirm the caller's org owns that project, so
// the DO can trust its `name`. Returning a Response rejects; void lets it through.

/**
 * Keep this console out of every index, on every response.
 *
 * The `<meta name="robots">` tags in __root.tsx only reach a crawler that
 * renders the page; this header also covers JSON, assets and redirects, and
 * needs no rendering. Both exist because this app is mounted on a marketing
 * hostname whose root is deliberately indexed, so nothing about the parent
 * site's robots.txt protects it.
 */
function withNoIndex(response: Response): Response {
  // A Response from a static asset can have immutable headers, so clone.
  const headers = new Headers(response.headers);
  headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet, noimageindex",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  // Scope a per-request Postgres client (no-op in D1 mode). The client isn't
  // closed here — the Workers↔Hyperdrive socket is reclaimed at invocation end.
  const response = await withPgClient(() =>
    Promise.resolve(handleFetch(request, env, ctx)),
  );
  // A 101 carries no body and rejects construction, so WebSocket upgrades pass
  // through untouched.
  return response.status === 101 ? response : withNoIndex(response);
}

function handleFetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Response | Promise<Response> {
  ctx.waitUntil(maybeSendSelfHostHeartbeat());

  const authMode = getAuthMode(env.AUTH_MODE);
  const publicRequest = requestWithPublicOrigin(request);
  const pathname = new URL(publicRequest.url).pathname;

  if (pathname === GDPR_STORAGE_ERASURE_PATH) {
    return handleGdprStorageErasure(publicRequest, env);
  }

  // Served before auth so a crawler is refused without meeting a login wall it
  // would have to interpret. At the root this is the app's own robots.txt; on a
  // sub-path deploy it also answers at BASE_PATH/robots.txt, which is where a
  // crawler that found a deep link will look next.
  if (pathname === withBasePath("/robots.txt")) {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=86400",
      },
    });
  }

  // Stripped BEFORE the hosted branch. Hosted mode returns through the OAuth
  // provider for every request, so rewriting only on the appFetch line below
  // would never run in the mode that actually serves sign-in.
  if (isHostedAuthMode(authMode)) {
    return upgradeSeoOAuthProvider.fetch(
      withApiBasePathStripped(publicRequest),
      env as UpgradeSeoOAuthEnv,
      ctx,
    );
  }

  if (
    (authMode === "cloudflare_access" || authMode === "local_noauth") &&
    pathname === MCP_ROUTE
  ) {
    return handleSelfHostedUpgradeSeoMcpRequest(
      publicRequest,
      authMode,
      env,
      ctx,
    );
  }

  return appFetch(withApiBasePathStripped(request));
}

/**
 * Remove the mount prefix from API paths before the app router sees them.
 *
 * Start applies `router.basepath` to PAGE routes only — file-based server
 * routes stay registered at their literal path, so on a sub-path deploy
 * `/UpgradeSEO/api/auth/ok` matches nothing and the router answers with an
 * empty 404. That is silent: the page shell still renders, and the only
 * visible symptom is a feature reporting itself unavailable, which is how
 * "Google sign in is not available right now" appeared while the sign-in page
 * itself looked healthy.
 *
 * Only `/api/*` is rewritten. Page routes genuinely expect the prefix, so
 * stripping it everywhere would break the navigation this exists to support.
 */
function withApiBasePathStripped(request: Request): Request {
  const url = new URL(request.url);
  // The path logic lives in shared/base-path.ts with the rest of the basepath
  // contract, where it is unit-tested; this wrapper only rebuilds the Request.
  const stripped = stripApiBasePath(url.pathname, BASE_PATH);
  if (stripped === url.pathname) return request;
  url.pathname = stripped;
  return new Request(url, request);
}

// Export Workflow classes as named exports
export { SiteAuditWorkflow } from "./server/workflows/SiteAuditWorkflow";
export { RankCheckWorkflow } from "./server/workflows/RankCheckWorkflow";
// Durable Object class for the onboarding strategy chat (Agents SDK).
// Durable Object class for the per-audit crawl scratchpad.
export { AuditScratchpad } from "./server/features/audit/AuditScratchpad";

// Daily OAuth KV garbage collection; must match a trigger in wrangler.jsonc.
const MCP_OAUTH_PURGE_CRON = "17 3 * * *";

export default {
  fetch,
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ) {
    if (controller.cron === MCP_OAUTH_PURGE_CRON) {
      // Only hosted mode runs the OAuth provider (and has OAUTH_KV bound).
      if (isHostedAuthMode(getAuthMode(env.AUTH_MODE))) {
        const result = await upgradeSeoOAuthProvider.purgeExpiredData(
          env as UpgradeSeoOAuthEnv,
        );
        console.log("[mcp-oauth] purged expired OAuth data", result);
        if (!result.done) {
          // The sweep only advances past live records via deletions; a
          // persistent incomplete scan means the keyspace outgrew the batch.
          console.warn("[mcp-oauth] purge did not cover the full keyspace");
        }
      }
      return;
    }

    // Watchdog first: reconcile audits stuck in "running" whose workflow died
    // without reaching mark-failed (OOM/CPU kills, expired instances). Runs
    // before the rank loop so a slow tick can't delay or starve it. Its
    // failure is held until after the rank checks so it can't suppress them,
    // then rethrown so the invocation still reports as failed.
    let watchdogError: unknown;
    try {
      await withPgClient(() => reconcileStaleAudits());
    } catch (err) {
      watchdogError = err;
      console.error("[cron] Stale-audit reconcile failed:", err);
    }
    // Scope a per-request Postgres client for the cron run (no-op in D1 mode).
    await withPgClient(() => runScheduledRankChecks(env));
    if (watchdogError) throw watchdogError;
  },
};
