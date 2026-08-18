import { waitUntil } from "cloudflare:workers";
import { z } from "zod";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import { AppError } from "@/server/lib/errors";
import {
  AI_SEARCH_PROMPT_CACHE_NAMESPACE,
  buildCacheKey,
  getCached,
  setCached,
} from "@/server/lib/r2-cache";
import {
  founderyMeasurementNotice,
  runFounderyAnswer,
  type FounderyAnswer,
} from "@/server/features/ai-search/services/founderyVisibility";
import type {
  PromptExplorerInput,
  PromptExplorerModel,
  PromptExplorerModelResult,
  PromptExplorerResult,
} from "@/types/schemas/ai-search";

/**
 * Prompt Explorer answers the user's prompt with our own Azure AI Foundry
 * deployment. Each prompt is cached in R2 for 7 days because model calls are
 * expensive and reasonably stable over short windows.
 *
 * WHAT THIS ANSWER IS AND IS NOT. It is what OUR model replies, once, right
 * now, and it has no web-search tool, so there are no cited sources and
 * anything past its training cutoff can be missing.
 *
 * Because there is exactly one engine, the vendor picker cannot be honoured.
 * Running the same deployment four times and captioning the answers ChatGPT,
 * Claude, Gemini and Perplexity would be four fabricated attributions, so we
 * answer ONCE. The result still has to occupy one of the vendor-named slots in
 * `PromptExplorerModel` (the union predates the single-engine path), so the
 * answer body opens with a notice correcting the card heading. See the
 * orchestrator note: the real fix is a "foundery" member on that union.
 */

/** LLM responses are stable enough for a 7-day cache. */
const PROMPT_RESPONSE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Hard cap on response length. Generous because reasoning deployments count
 * hidden chain-of-thought tokens against this budget — a cap sized to the
 * visible answer gets spent on reasoning and returns a near-empty message.
 */
const PROMPT_RESPONSE_MAX_TOKENS = 4096;

export async function explorePrompt(
  input: PromptExplorerInput,
  billingCustomer: OrganizationContext,
): Promise<PromptExplorerResult> {
  const highlightBrand = input.highlightBrand?.trim() || null;
  const slot = input.models[0];

  let answer: FounderyAnswer;
  try {
    answer = await fetchFounderyAnswer(input, billingCustomer);
  } catch (error) {
    // A missing Foundery key is a setup problem the user can fix, so it must
    // reach them as its own error rather than as a per-card "try again".
    if (error instanceof AppError) throw error;
    return {
      prompt: input.prompt,
      highlightBrand,
      fetchedAt: new Date().toISOString(),
      results: [mapErrorToResult(slot, error)],
    };
  }

  return {
    prompt: input.prompt,
    highlightBrand,
    fetchedAt: new Date().toISOString(),
    results: [
      {
        status: "success" as const,
        model: slot,
        modelName: `${answer.modelName} on Azure AI Foundry`,
        text: `${founderyMeasurementNotice(answer.modelName)}\n\n${answer.text}`,
        // No web-search tool means no annotations, so there is nothing to cite
        // and no fan-out queries to report. Empty, never invented.
        citations: [],
        fanOutQueries: [],
        // Computed on the raw answer rather than the notice-prefixed text, so
        // wording inside our own notice can never satisfy a brand match.
        brandMentioned: computeBrandMentioned(answer.text, highlightBrand),
        outputTokens: answer.outputTokens,
        webSearch: false,
      },
    ],
  };
}

/** Only the fields we can honestly reconstruct from a Foundery text answer. */
const founderyAnswerCacheSchema = z.object({
  text: z.string(),
  modelName: z.string(),
  outputTokens: z.number().int().nonnegative().nullable(),
});

async function fetchFounderyAnswer(
  input: PromptExplorerInput,
  billingCustomer: OrganizationContext,
): Promise<FounderyAnswer> {
  const cacheKey = await buildCacheKey(AI_SEARCH_PROMPT_CACHE_NAMESPACE, {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    source: "foundery",
    // Collapse only whitespace differences. Casing is deliberately preserved:
    // prompts like "Compare Go vs go" or case-sensitive code snippets must
    // not collide with their lowercase twins.
    prompt: normalizePromptForCache(input.prompt),
    systemPromptV: 1,
  });

  const cached = founderyAnswerCacheSchema.safeParse(await getCached(cacheKey));
  if (cached.success) return cached.data;

  const answer = await runFounderyAnswer({
    organizationId: billingCustomer.organizationId,
    prompt: input.prompt,
    maxOutputTokens: PROMPT_RESPONSE_MAX_TOKENS,
  });

  waitUntil(
    setCached(cacheKey, answer, PROMPT_RESPONSE_TTL_SECONDS, {
      organizationId: billingCustomer.organizationId,
    }).catch((err) => {
      console.error("ai-search.foundery-response.cache-write failed:", err);
    }),
  );

  return answer;
}

function computeBrandMentioned(
  text: string,
  highlightBrand: string | null,
): boolean | null {
  if (!highlightBrand) return null;
  return mentionRegex(highlightBrand).test(text);
}

function mentionRegex(brand: string): RegExp {
  // Case-insensitive match on the brand string with word-boundary guards only
  // on sides that end in a word char — otherwise \b fails for brands like
  // "C++" or "AT&T" where the terminal char is non-word. When a boundary char
  // is non-word we guard with a negative lookaround against that same char so
  // "C++" doesn't match "C+++".
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const firstEscaped = brand[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lastEscaped = brand[brand.length - 1].replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const leading = /^\w/.test(brand) ? "\\b" : `(?<!${firstEscaped})`;
  const trailing = /\w$/.test(brand) ? "\\b" : `(?!${lastEscaped})`;
  return new RegExp(`${leading}${escaped}${trailing}`, "i");
}

function normalizePromptForCache(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ");
}

function mapErrorToResult(
  model: PromptExplorerModel,
  reason: unknown,
): PromptExplorerModelResult {
  // Log full upstream detail server-side; surface only a generic message to
  // the client. Upstream error bodies sometimes echo request paths or
  // diagnostic fields we don't want to leak to the browser.
  console.error(`ai-search.prompt-response.${model}.error:`, reason);

  return {
    status: "error" as const,
    model,
    errorCode: "UPSTREAM_ERROR",
    message: "This model is temporarily unavailable. Please try again.",
  };
}
