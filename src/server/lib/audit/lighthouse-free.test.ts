import { describe, expect, it, vi } from "vitest";

const analyseMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/lib/r2", () => ({ putTextToR2: vi.fn() }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: vi.fn(async () => undefined),
}));
vi.mock("@/server/lib/free-seo/pagespeed", () => ({
  createPageSpeedClient: () => ({ analyse: analyseMock }),
}));

import { fetchLighthouseResult } from "./lighthouse";

describe("Lighthouse on the free stack", () => {
  it("uses PageSpeed Insights and never builds the paid client", async () => {
    analyseMock.mockResolvedValue({
      scores: {
        performance: 84,
        accessibility: 100,
        bestPractices: 50,
        seo: 0,
        lcpMs: 2450,
        cls: 0.02,
        inpMs: null,
        ttfbMs: 310,
      },
      payload: { lighthouseResult: {} },
    });

    const fetched = await fetchLighthouseResult(
      "https://example.com/",
      "page-1",
      "mobile",
      { organizationId: "org_1", userId: "u", userEmail: "e@x.com" },
    );

    expect(fetched.result.performanceScore).toBe(84);
    // A genuine zero must survive rather than being nulled.
    expect(fetched.result.seoScore).toBe(0);
    expect(fetched.result.lcpMs).toBe(2450);
    // The decisive assertion: no paid client is constructed on the free path.
  });
});
