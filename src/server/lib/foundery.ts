import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// The provider returns @ai-sdk/provider's LanguageModelV3. Deriving the type
// from the provider itself avoids both a cross-package assertion and a direct
// dependency on a transitive package.
type FounderyModel = ReturnType<
  ReturnType<typeof createOpenAICompatible>["chatModel"]
>;

/**
 * Azure AI Foundry ("Foundery") as the chat-agent engine.
 *
 * This exists so the in-app agents run on our own Azure deployment instead of
 * a metered third-party AI vendor, which the owner mandate requires. Foundery
 * runs on the deployment's own Azure quota, and it is the sanctioned provider
 * and no per-request charge reaches a card.
 *
 * WHY THE v1 ROUTE. Azure's newer `/openai/v1/` surface is OpenAI-compatible
 * and needs NO `api-version` query parameter, which removes the version-pinning
 * churn the legacy deployment-in-path route forces on every upgrade. Verified
 * against our own resource: the v1 route returns 200, while
 * `/openai/deployments/{deployment}/chat/completions` without an api-version
 * returns 404.
 *
 * AUTH IN WORKERD. A static resource key, sent as either `api-key` or
 * `Authorization: Bearer`. Both were verified to return 200. There is no JWT to
 * sign, no MSAL, no service-account key and no gRPC, which is precisely why
 * this works under Cloudflare workerd where the Azure SDKs do not.
 *
 * ⚠️ DEPENDENCY PIN. `@ai-sdk/openai-compatible` must stay on the `ai-v6`
 * dist-tag (2.0.68). `latest` (3.x) returns a LanguageModelV4, which `ai@6`
 * does not accept. See the dated entry in pnpm-workspace.yaml.
 */

/** Our own resource. Overridable so other installs point at theirs. */
const DEFAULT_ENDPOINT = "https://sonar-growth-ai-se.services.ai.azure.com";

/** gpt-oss-120b. The cheap deployment is the right default for chat turns. */
const DEFAULT_DEPLOYMENT = "growth-cheap";

/**
 * Accepts either a bare resource host or one that already includes the
 * `/openai/v1` suffix, because users paste both. Normalising here keeps the
 * Settings field forgiving instead of failing with an opaque 404.
 */
export function normaliseFounderyBaseUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (!trimmed) return `${DEFAULT_ENDPOINT}/openai/v1`;
  if (trimmed.endsWith("/openai/v1")) return trimmed;
  if (trimmed.endsWith("/openai")) return `${trimmed}/v1`;
  return `${trimmed}/openai/v1`;
}

/**
 * The public field holds "endpoint" or "endpoint|deployment", so one input can
 * carry both without a second column.
 */
export function parseFounderyTarget(publicIdentifier: string | null): {
  baseUrl: string;
  deployment: string;
} {
  const [endpoint = "", deployment = ""] = (publicIdentifier ?? "").split("|");
  return {
    baseUrl: normaliseFounderyBaseUrl(endpoint),
    deployment: deployment.trim() || DEFAULT_DEPLOYMENT,
  };
}

/**
 * Rewrites the token-budget field on the way out.
 *
 * The reasoning deployments (gpt-5.x on `growth-frontier`) reject `max_tokens`
 * outright with a 400 and demand `max_completion_tokens`. The SDK still emits
 * the old name whenever a caller sets `maxOutputTokens`, and both of ours do,
 * so without this every frontier call fails. Verified against the live
 * resource: `growth-frontier` 400s on `max_tokens` and 200s on the new name,
 * and `growth-cheap` 200s on either, so renaming unconditionally is safe for
 * both and needs no per-deployment branch.
 */
function renameTokenBudget(init?: RequestInit): RequestInit | undefined {
  if (typeof init?.body !== "string") return init;
  // `unknown` rather than a cast: the `in` check below narrows it, so the
  // rename never runs on a body that does not carry the field.
  const body: unknown = JSON.parse(init.body);
  if (body === null || typeof body !== "object" || !("max_tokens" in body)) {
    return init;
  }
  const { max_tokens: budget, ...rest } = body;
  return {
    ...init,
    body: JSON.stringify({ ...rest, max_completion_tokens: budget }),
  };
}

/**
 * Synchronous variant, mirroring `buildChatAgentModel` in openrouter.ts:
 * Think's `getModel()` hook is sync and runs on every turn.
 *
 * `.chatModel()` targets `/chat/completions`. Do not switch to the responses
 * surface: gpt-oss-120b rejects `tools` there, which would silently disable
 * the agent's entire toolset.
 */
export function buildFounderyChatModel(
  apiKey: string,
  publicIdentifier: string | null,
): FounderyModel {
  const { baseUrl, deployment } = parseFounderyTarget(publicIdentifier);
  return createOpenAICompatible({
    name: "foundery",
    baseURL: baseUrl,
    apiKey,
    fetch: (input, init) => globalThis.fetch(input, renameTokenBudget(init)),
  }).chatModel(deployment);
}
