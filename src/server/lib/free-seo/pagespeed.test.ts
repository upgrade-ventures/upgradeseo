import { describe, expect, it, vi } from "vitest";

import {
  createPageSpeedClient,
  extractScores,
} from "@/server/lib/free-seo/pagespeed";

describe("PageSpeed score extraction", () => {
  const payload = {
    lighthouseResult: {
      categories: {
        performance: { score: 0.84 },
        accessibility: { score: 1 },
        "best-practices": { score: 0.5 },
        seo: { score: 0 },
      },
      audits: {
        "largest-contentful-paint": { numericValue: 2450.7 },
        "cumulative-layout-shift": { numericValue: 0.02 },
        "server-response-time": { numericValue: 310 },
      },
    },
  };

  it("converts PSI's 0-1 scores to the 0-100 the app stores", () => {
    const scores = extractScores(payload);
    expect(scores.performance).toBe(84);
    expect(scores.accessibility).toBe(100);
    expect(scores.bestPractices).toBe(50);
    // A genuine zero must survive, not be coerced to null.
    expect(scores.seo).toBe(0);
  });

  it("reads Core Web Vitals and leaves INP null", () => {
    const scores = extractScores(payload);
    expect(scores.lcpMs).toBe(2450.7);
    expect(scores.cls).toBe(0.02);
    expect(scores.ttfbMs).toBe(310);
    // A lab run cannot measure INP; reporting Total Blocking Time as INP
    // would be a different metric wearing the wrong label.
    expect(scores.inpMs).toBeNull();
  });

  it("returns nulls for a payload with no lighthouse result", () => {
    const scores = extractScores({ error: { code: 429 } });
    expect(scores.performance).toBeNull();
    expect(scores.lcpMs).toBeNull();
  });
});

describe("PageSpeed client", () => {
  it("requests every category, not just performance", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ lighthouseResult: {} })),
    );
    const psi = createPageSpeedClient({ fetchImpl });
    await psi.analyse({ url: "https://example.com", strategy: "mobile" });

    const [requested] = fetchImpl.mock.calls[0] ?? [];
    const url = typeof requested === "string" ? requested : "";
    // PSI returns performance only by default, silently nulling the rest.
    expect(url).toContain("category=performance");
    expect(url).toContain("category=accessibility");
    expect(url).toContain("category=seo");
  });

  it("names the fix when an unauthenticated call hits the shared quota", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 }));
    const psi = createPageSpeedClient({ fetchImpl });
    await expect(
      psi.analyse({ url: "https://example.com", strategy: "mobile" }),
    ).rejects.toThrow(/PAGESPEED_API_KEY/);
  });
});
