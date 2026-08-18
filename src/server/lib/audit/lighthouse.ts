import { detectUrlTemplate, canonicalUrlKey } from "./url-utils";
import type { OrganizationContext } from "@/server/auth/organizationContext";
import type { LighthouseResult, LighthouseStrategy } from "./types";
import { putTextToR2 } from "@/server/lib/r2";
import { createPageSpeedClient } from "@/server/lib/free-seo/pagespeed";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

interface LighthouseSamplePage {
  url: string;
  statusCode: number;
}

function canonicalUrlKeyWithoutTrailingSlash(url: string): string {
  const parsed = new URL(canonicalUrlKey(url));
  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
  }
  return parsed.toString();
}

type LighthouseFetchResult = {
  result: LighthouseResult;
  payloadJson: string | null;
};

export async function fetchLighthouseResult(
  url: string,
  pageId: string,
  strategy: "mobile" | "desktop",
  _billingCustomer: OrganizationContext,
  /**
   * Uploads the raw payload before this function returns. A Lighthouse report
   * is routinely larger than the 1MiB ceiling on a Workflow step's output, and
   * a mobile+desktop pair doubles it, so returning `payloadJson` across the
   * step boundary failed the whole run with `step_output_too_large` — Lighthouse
   * audits could never complete. Uploading here keeps the checkpoint small
   * while preserving the reason the fetch is its own step: a later storage
   * failure must not replay the PageSpeed call.
   */
  storage?: { projectId: string; auditId: string },
): Promise<LighthouseFetchResult> {
  try {
    // PageSpeed Insights runs the same Lighthouse engine on Google's own
    // infrastructure, free. It is the only path.
    {
      const psi = createPageSpeedClient({
        apiKey: await getOptionalEnvValue("PAGESPEED_API_KEY"),
      });
      const { scores, payload } = await psi.analyse({ url, strategy });
      const payloadJson = JSON.stringify(payload);
      const uploaded = storage
        ? await putTextToR2(
            lighthousePayloadKey(storage, pageId, strategy),
            payloadJson,
          )
        : null;
      return {
        result: {
          url,
          pageId,
          strategy,
          performanceScore: scores.performance,
          accessibilityScore: scores.accessibility,
          bestPracticesScore: scores.bestPractices,
          seoScore: scores.seo,
          lcpMs: scores.lcpMs,
          cls: scores.cls,
          inpMs: scores.inpMs,
          ttfbMs: scores.ttfbMs,
          ...(uploaded
            ? { r2Key: uploaded.key, payloadSizeBytes: uploaded.sizeBytes }
            : {}),
        },
        // Held back only when nobody uploaded it, so callers without an
        // uploader keep the previous behaviour.
        payloadJson: uploaded ? null : payloadJson,
      };
    }
  } catch (error) {
    const failed = error instanceof Error ? error : new Error(String(error));
    console.error(`Lighthouse failed for ${url}:`, failed.message);
    return {
      result: {
        url,
        pageId,
        strategy,
        performanceScore: null,
        accessibilityScore: null,
        bestPracticesScore: null,
        seoScore: null,
        lcpMs: null,
        cls: null,
        inpMs: null,
        ttfbMs: null,
        errorMessage: failed.message,
      },
      payloadJson: null,
    };
  }
}

function lighthousePayloadKey(
  storage: { projectId: string; auditId: string },
  pageId: string,
  strategy: string,
): string {
  return `site-audit/${storage.projectId}/${storage.auditId}/${pageId}-${strategy}.json`;
}

export async function storeLighthouseResult(input: {
  projectId: string;
  auditId: string;
  fetched: LighthouseFetchResult;
}): Promise<LighthouseResult> {
  // Null once the fetch step uploaded the payload itself; the result already
  // carries r2Key, so re-uploading here would only repeat the write.
  if (!input.fetched.payloadJson) {
    return input.fetched.result;
  }

  const { pageId, strategy } = input.fetched.result;
  const key = lighthousePayloadKey(input, pageId, strategy);
  const uploaded = await putTextToR2(key, input.fetched.payloadJson);

  return {
    ...input.fetched.result,
    r2Key: uploaded.key,
    payloadSizeBytes: uploaded.sizeBytes,
  };
}

/**
 * Select which pages to run Lighthouse on, based on the chosen strategy.
 */
export function selectLighthouseSample(
  pages: LighthouseSamplePage[],
  startUrl: string,
  strategy: LighthouseStrategy,
): string[] {
  if (strategy === "none") return [];

  // Only consider pages that loaded successfully
  const validPages = pages.filter(
    (p) => p.statusCode >= 200 && p.statusCode < 300,
  );

  // strategy === "auto": homepage + 1 per URL pattern, capped at 10
  const selected = new Set<string>();

  // Always include the start URL / homepage. Prefer an exact canonical match
  // so distinct 2xx `/path` and `/path/` pages stay distinct, then tolerate a
  // trailing-slash redirect when the exact start URL was not crawled as 2xx.
  const startKey = canonicalUrlKey(startUrl);
  const startPage =
    validPages.find((p) => canonicalUrlKey(p.url) === startKey) ??
    validPages.find(
      (p) =>
        canonicalUrlKeyWithoutTrailingSlash(p.url) ===
        canonicalUrlKeyWithoutTrailingSlash(startUrl),
    );
  if (startPage) selected.add(startPage.url);

  // Group by URL template pattern
  const templateGroups = new Map<string, LighthouseSamplePage>();
  if (startPage) {
    templateGroups.set(
      detectUrlTemplate(new URL(startPage.url).pathname),
      startPage,
    );
  }
  for (const page of validPages) {
    if (selected.has(page.url)) continue;
    const template = detectUrlTemplate(new URL(page.url).pathname);
    if (!templateGroups.has(template)) {
      templateGroups.set(template, page);
    }
  }

  // Add one page per template group
  for (const [, page] of templateGroups) {
    if (selected.size >= 10) break;
    selected.add(page.url);
  }

  return Array.from(selected);
}
