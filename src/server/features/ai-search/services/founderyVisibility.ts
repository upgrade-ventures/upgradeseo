import { generateText } from "ai";
import { buildFounderyChatModel } from "@/server/lib/foundery";
import { AppError } from "@/server/lib/errors";

/**
 * AI visibility measured by ASKING A MODEL, not by buying a dataset.
 *
 * READ THIS BEFORE USING ANY NUMBER OUT OF THIS MODULE. The paid AI-mentions
 * dataset sampled what real assistants told real users and aggregated those
 * samples over time, which is what made "AI search volume", "monthly trend"
 * and "share of voice" meaningful. This module does something fundamentally
 * different and much smaller: it sends a handful of prompts to OUR OWN model
 * on Azure AI Foundry, once, right now, and counts whether the brand came
 * back. One model, one moment, our own question set.
 *
 * That supports exactly one claim: "our model named this brand in N of M
 * answers to these prompts, at this time". It cannot support any claim about
 * market-wide AI visibility, about what ChatGPT or Google AI Overviews tell
 * real users, about share of voice, or about any trend over time. Every field
 * that needed the aggregate dataset is reported as unavailable rather than
 * derived from this, and callers must not fill those gaps with an estimate.
 *
 * The model also has no web-search tool, so it answers from training data
 * alone. A brand missing from an answer may simply be newer than the training
 * cutoff rather than invisible, and there are no cited sources at all.
 */

/**
 * Budgets are generous because the default deployment (gpt-oss-120b) is a
 * REASONING model and its hidden chain-of-thought counts against this cap, the
 * same trap PROMPT_RESPONSE_MAX_TOKENS documents in promptExplorer.ts. A cap
 * sized to the visible answer gets spent on reasoning and returns an empty
 * message, which here would not fail loudly: it would look like a probe in
 * which the model simply never named the brand, and a measured zero built out
 * of empty answers is exactly the fabricated number this module must not
 * produce. Empty replies are excluded from the ratio for the same reason.
 */
const PROBE_MAX_OUTPUT_TOKENS = 2048;

/**
 * The category itself is a few words, but the reasoning preceding it is not,
 * so the budget has to cover both. normaliseCategory still rejects anything
 * that comes back longer than a category.
 */
const CATEGORY_MAX_OUTPUT_TOKENS = 1024;

/**
 * A category longer than this is the model refusing or rambling rather than
 * classifying, and a rambling "category" would produce nonsense probes.
 */
const MAX_CATEGORY_LENGTH = 60;

type FounderyProbe = {
  /** The prompt as sent. It never names the target, see buildProbePrompts. */
  prompt: string;
  /** True when the answer named the target brand or its domain. */
  mentioned: boolean;
  answer: string;
};

type FounderyBrandVisibility =
  | {
      status: "measured";
      /** The Foundery deployment that answered, for on-page attribution. */
      modelName: string;
      /** The category the model placed the target in, used to build probes. */
      category: string;
      probes: FounderyProbe[];
      /** Probes that named the target. Measured, never estimated. */
      mentionedCount: number;
      /** Probes that actually returned an answer. Failed calls are excluded. */
      probeCount: number;
      /** mentionedCount over probeCount as a percentage, one decimal place. */
      mentionRatePct: number;
    }
  | {
      status: "unavailable";
      /**
       * "unrecognised" means the measurement ran and produced nothing to
       * measure; "name_is_category" means the target cannot be told apart from
       * the questions asked about it; "probe_failed" means the calls broke.
       * Callers must keep them apart: only the last one is worth a retry, and
       * none of them may be reported as a mention count of zero.
       */
      kind: "unrecognised" | "name_is_category" | "probe_failed";
      reason: string;
    };

/**
 * The on-page correction. It has to name what the number is and what it is
 * not, because the surrounding UI was written for the aggregate dataset.
 */
export function founderyMeasurementNotice(modelName: string): string {
  return [
    `> **Answered by our own model, not by the assistant named above.**`,
    `> The prompt was sent to our Azure AI Foundry deployment (\`${modelName}\`) just now.`,
    `> This is one answer, from one model, at one moment. It is not a sample of what`,
    `> real assistants told real users, so it cannot show market-wide AI visibility,`,
    `> share of voice, or any trend over time.`,
    `>`,
    `> The model has no web-search tool, so it answers from training data alone.`,
    `> Anything newer than its training cutoff can be missing for that reason rather`,
    `> than because it is invisible, and there are no cited sources to show.`,
  ].join("\n");
}

/**
 * Probes deliberately never name the target. Asking "what is Ahrefs" would
 * make the model repeat the name back and every brand would score 100%. Asking
 * about the category measures the thing the page claims to measure: whether
 * the model brings the brand up on its own.
 */
function buildProbePrompts(category: string): string[] {
  return [
    `What are the best ${category} options available today? List them with a one line reason each.`,
    `Recommend a ${category} for a small business on a tight budget.`,
    `Which ${category} providers do professionals recommend most often?`,
    `I am comparing ${category} options. Which ones belong on my shortlist?`,
    `What is the most widely used ${category} right now, and why?`,
    `Name a few well known ${category} companies.`,
  ];
}

function buildCategoryPrompt(
  target: string,
  targetType: "domain" | "keyword",
): string {
  const subject =
    targetType === "domain" ? `the website ${target}` : `the brand ${target}`;
  return `In at most four words, what category of product or service is ${subject}? Reply with the category only, no punctuation, no explanation. If you do not recognise it, reply exactly: UNKNOWN`;
}

/**
 * Returns null when the model did not classify the target, which is the honest
 * outcome for a brand it has never seen. Callers report that as unavailable
 * rather than probing a made-up category.
 */
export function normaliseCategory(raw: string): string | null {
  // Last non-empty line only: a reasoning deployment often narrates first and
  // puts the actual answer last, and treating the narration as the category
  // would send made-up probes.
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const cleaned = (lines.at(-1) ?? "")
    .trim()
    .replace(/^["'`]+|["'`.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (cleaned.length > MAX_CATEGORY_LENGTH) return null;
  if (/^unknown$/i.test(cleaned)) return null;
  return cleaned;
}

/**
 * A domain target is matched on both the full host and its first label,
 * because models write "Ahrefs" far more often than "ahrefs.com". Single
 * character labels are dropped: a bare "x" would match almost any answer.
 */
function targetNeedles(
  target: string,
  targetType: "domain" | "keyword",
): string[] {
  if (targetType !== "domain") {
    const keyword = target.trim();
    return keyword ? [keyword] : [];
  }
  const host = target
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  if (!host) return [];
  const label = host.split(".")[0];
  return label.length > 1 && label !== host ? [host, label] : [host];
}

export function mentionsTarget(
  answer: string,
  target: string,
  targetType: "domain" | "keyword",
): boolean {
  return matchesAny(answer, targetNeedles(target, targetType));
}

function matchesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => needleRegex(needle).test(text));
}

/**
 * Drops any needle the category itself contains. Every probe prompt names the
 * category, so an answer about "travel booking" says "booking" whether or not
 * it means booking.com, and counting that would hand generic-word brands a
 * near perfect score by construction rather than by measurement. The full host
 * usually survives ("Booking.com" is still a real mention), and a target left
 * with no usable needle cannot be measured this way at all.
 */
function usableNeedles(
  target: string,
  targetType: "domain" | "keyword",
  category: string,
): string[] {
  return targetNeedles(target, targetType).filter(
    (needle) => !needleRegex(needle).test(category),
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary guards only on sides that end in a word character, so brands
 * like "C++" still match. Mirrors the same guard in promptExplorer.ts.
 */
function needleRegex(needle: string): RegExp {
  const leading = /^\w/.test(needle) ? "\\b" : `(?<!${escapeRegex(needle[0])})`;
  const trailing = /\w$/.test(needle)
    ? "\\b"
    : `(?!${escapeRegex(needle[needle.length - 1])})`;
  return new RegExp(`${leading}${escapeRegex(needle)}${trailing}`, "i");
}

function mentionRatePct(mentionedCount: number, probeCount: number): number {
  if (probeCount <= 0) return 0;
  return Math.round((mentionedCount / probeCount) * 1000) / 10;
}

/**
 * Imported dynamically because provider-keys reaches the database, and the
 * pure helpers above are unit tested without a D1 binding.
 */
async function resolveFounderyModel(organizationId: string | null) {
  const { resolveProviderKey } =
    await import("@/server/features/provider-keys/providerKeys");
  const key = await resolveProviderKey(organizationId, "foundery");
  if (!key) return null;
  return buildFounderyChatModel(key.secret, key.publicIdentifier);
}

async function requireFounderyModel(organizationId: string | null) {
  const model = await resolveFounderyModel(organizationId);
  if (model) return model;
  throw new AppError(
    "DATA_SOURCE_NOT_CONFIGURED",
    "No AI answer source is connected. Add a Foundery (Azure AI) key in Settings, Data provider keys. AI Search runs entirely on that deployment, so there is nothing else to buy.",
  );
}

export type FounderyAnswer = {
  text: string;
  /** The Foundery deployment id, so the page can attribute the answer. */
  modelName: string;
  outputTokens: number | null;
};

type FounderyModel = Awaited<ReturnType<typeof requireFounderyModel>>;

async function answerWith(
  model: FounderyModel,
  prompt: string,
  maxOutputTokens: number,
): Promise<FounderyAnswer> {
  const result = await generateText({ model, prompt, maxOutputTokens });
  return {
    text: result.text.trim(),
    modelName: model.modelId,
    // Null rather than 0 when the provider omitted usage: a zero token count
    // would read as "the model produced nothing".
    outputTokens: result.usage.outputTokens ?? null,
  };
}

export async function runFounderyAnswer(args: {
  organizationId: string | null;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<FounderyAnswer> {
  const model = await requireFounderyModel(args.organizationId);
  return answerWith(
    model,
    args.prompt,
    args.maxOutputTokens ?? PROBE_MAX_OUTPUT_TOKENS,
  );
}

/**
 * Classify the target, then ask the category questions and count the answers
 * that name it. Probes run concurrently and are settled independently: a probe
 * that failed is excluded from BOTH sides of the ratio, never counted as a
 * miss, because a network error is not evidence that the model omitted the
 * brand.
 */
export async function measureBrandVisibility(args: {
  organizationId: string | null;
  target: string;
  targetType: "domain" | "keyword";
}): Promise<FounderyBrandVisibility> {
  // Resolved once and shared by every call below. Seven separate resolutions
  // would mean seven key decryptions and seven provider instances for what is
  // one deployment.
  const model = await requireFounderyModel(args.organizationId);

  const classification = await answerWith(
    model,
    buildCategoryPrompt(args.target, args.targetType),
    CATEGORY_MAX_OUTPUT_TOKENS,
  );

  const category = normaliseCategory(classification.text);
  if (!category) {
    return {
      status: "unavailable",
      kind: "unrecognised",
      reason: `Our model does not recognise ${args.target}, so it cannot be asked category questions about it. This is a limit of one model's training data, not evidence that the brand is absent from AI answers.`,
    };
  }

  const needles = usableNeedles(args.target, args.targetType, category);
  if (needles.length === 0) {
    return {
      status: "unavailable",
      kind: "name_is_category",
      reason: `Our model classified ${args.target} as "${category}", which repeats the target's own name. Every probe asks about that category, so an answer mentioning it would prove nothing about the brand, and there is no way to tell a real mention from an echo of the question.`,
    };
  }

  const prompts = buildProbePrompts(category);
  const settled = await Promise.allSettled(
    prompts.map((prompt) => answerWith(model, prompt, PROBE_MAX_OUTPUT_TOKENS)),
  );

  const probes: FounderyProbe[] = [];
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("ai-search.foundery.probe.error:", result.reason);
      return;
    }
    // An empty reply is a broken probe, not a miss. Scoring it as "the model
    // did not name the brand" would build a measured zero out of answers the
    // model never gave.
    if (!result.value.text) {
      console.error("ai-search.foundery.probe.empty:", prompts[index]);
      return;
    }
    probes.push({
      prompt: prompts[index],
      answer: result.value.text,
      mentioned: matchesAny(result.value.text, needles),
    });
  });

  if (probes.length === 0) {
    return {
      status: "unavailable",
      kind: "probe_failed",
      reason:
        "Every probe to our own model failed or came back empty, so there is no measurement to report.",
    };
  }

  const mentionedCount = probes.filter((probe) => probe.mentioned).length;
  return {
    status: "measured",
    modelName: classification.modelName,
    category,
    probes,
    mentionedCount,
    probeCount: probes.length,
    mentionRatePct: mentionRatePct(mentionedCount, probes.length),
  };
}
