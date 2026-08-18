import { describe, expect, it } from "vitest";

import {
  normaliseFounderyBaseUrl,
  parseFounderyTarget,
} from "@/server/lib/foundery";

describe("Foundery endpoint handling", () => {
  it("accepts a bare resource host and appends the v1 route", () => {
    // The legacy deployment-in-path route 404s without an api-version, so the
    // /openai/v1 suffix is load-bearing, not cosmetic.
    expect(
      normaliseFounderyBaseUrl(
        "https://sonar-growth-ai-se.services.ai.azure.com",
      ),
    ).toBe("https://sonar-growth-ai-se.services.ai.azure.com/openai/v1");
  });

  it("does not double-append when the user pastes the full route", () => {
    const full = "https://x.services.ai.azure.com/openai/v1";
    expect(normaliseFounderyBaseUrl(full)).toBe(full);
    expect(normaliseFounderyBaseUrl(`${full}/`)).toBe(full);
    expect(
      normaliseFounderyBaseUrl("https://x.services.ai.azure.com/openai"),
    ).toBe(full.replace("/x.", "/x."));
  });

  it("splits endpoint and deployment out of one field", () => {
    const target = parseFounderyTarget(
      "https://x.services.ai.azure.com|growth-frontier",
    );
    expect(target.baseUrl).toBe("https://x.services.ai.azure.com/openai/v1");
    expect(target.deployment).toBe("growth-frontier");
  });

  it("falls back to the cheap deployment when none is given", () => {
    expect(
      parseFounderyTarget("https://x.services.ai.azure.com").deployment,
    ).toBe("growth-cheap");
    expect(parseFounderyTarget(null).deployment).toBe("growth-cheap");
  });
});
