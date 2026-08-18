import { waitUntil } from "cloudflare:workers";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import { AppError } from "@/server/lib/errors";
import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import { measureBrandVisibility } from "@/server/features/ai-search/services/founderyVisibility";
import {
  brandLookupResultSchema,
  type BrandLookupInput,
  type BrandLookupResult,
} from "@/types/schemas/ai-search";
import { detectTarget } from "@/shared/targetDetection";

/**
 * Brand Lookup measures AI visibility by ASKING A MODEL: we send our own Azure
 * AI Foundry deployment a set of category questions that never name the target
 * and count the answers that bring it up anyway. Stateless — no DB writes, R2
 * caching only.
 *
 * WHAT THIS NUMBER IS AND IS NOT. `totalMentions` is "answers out of our probe
 * set that named this brand", a real count of a real sample we took. The
 * fields below needed an aggregate dataset sampled from real assistants and
 * real users over time; one model call cannot produce a market-wide
 * measurement, so they are reported as absent rather than reconstructed:
 *
 *   totalAiSearchVolume  null   prompt demand needs real user traffic
 *   monthlyVolume        []     one measurement cannot make a 12 month trend
 *   shareOfVoice         null   competitor share needs the same aggregate
 *   topPages             []     no web-search tool means no cited sources
 *   perPlatform          []     our model is neither ChatGPT nor Google AIO,
 *                               so attributing the count to either would be a
 *                               fabricated source
 *
 * `topQueries` stays empty for the same attribution reason and NOT because the
 * prompts are unknown: every probe prompt and its hit or miss is available on
 * the visibility measurement, but `brandTopQuerySchema.platform` only admits
 * "chat_gpt" or "google", and the schema is outside this task's file scope.
 * See the orchestrator note.
 */

/** The measurement is a snapshot, so it ages out on a daily clock. */
const BRAND_LOOKUP_TTL_SECONDS = 24 * 60 * 60;

export async function getBrandLookup(
  input: BrandLookupInput,
  billingCustomer: OrganizationContext,
): Promise<BrandLookupResult> {
  const detected = detectTarget(input.query);

  // The key carries no location, language or competitor list: one model
  // answering one question set is not localised and does not vary with those
  // inputs, so pretending the result differs would be its own small fiction.
  const cacheKey = await buildCacheKey("ai-search:brand-lookup-foundery", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    targetType: detected.type,
    targetValue: detected.value.toLowerCase(),
  });

  const cached = brandLookupResultSchema.safeParse(await getCached(cacheKey));
  if (cached.success) {
    return {
      ...cached.data,
      query: input.query,
      resolvedTarget: detected.value,
    };
  }

  const visibility = await measureBrandVisibility({
    organizationId: billingCustomer.organizationId,
    target: detected.value,
    targetType: detected.type,
  });

  // Only a broken run is an error the user should retry. The other unavailable
  // kinds are settled outcomes: retrying spends more model calls on the same
  // answer.
  if (
    visibility.status === "unavailable" &&
    visibility.kind === "probe_failed"
  ) {
    throw new AppError("UPSTREAM_UNAVAILABLE", visibility.reason);
  }

  const result: BrandLookupResult = {
    query: input.query,
    detectedTargetType: detected.type,
    resolvedTarget: detected.value,
    fetchedAt: new Date().toISOString(),
    // A brand our model has never heard of yields no measurement at all, which
    // is different from a measured zero, so the count stays null rather than 0.
    hasData: visibility.status === "measured" && visibility.mentionedCount > 0,
    // Null whenever the run produced no measurement (the model does not know
    // the target, or its name is indistinguishable from the questions we ask
    // about it). Only a measured miss is allowed to be 0.
    //
    // ⚠️ The client cannot yet tell those two apart: BrandLookupResults renders
    // any `hasData: false` as "No AI mentions found", which for the
    // no-measurement cases states a result we never obtained. The reason text
    // to show instead is already on `visibility.reason`, but there is no field
    // on BrandLookupResult to carry it. See the orchestrator note.
    totalMentions:
      visibility.status === "measured" ? visibility.mentionedCount : null,
    totalAiSearchVolume: null,
    perPlatform: [],
    shareOfVoice: null,
    topPages: [],
    topQueries: [],
    monthlyVolume: [],
  };

  if (result.hasData) {
    waitUntil(
      setCached(cacheKey, result, BRAND_LOOKUP_TTL_SECONDS).catch((err) => {
        console.error("ai-search.brand-lookup.cache-write failed:", err);
      }),
    );
  }

  return result;
}
