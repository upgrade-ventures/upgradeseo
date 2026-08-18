import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ waitUntil: vi.fn() }));

const { measureBrandVisibilityMock, cacheMock } = vi.hoisted(() => ({
  measureBrandVisibilityMock: vi.fn(),
  cacheMock: {
    buildCacheKey: vi.fn(async (_prefix: string, params: unknown) =>
      JSON.stringify(params),
    ),
    getCached: vi.fn(),
    setCached: vi.fn(async () => undefined),
  },
}));

vi.mock("./founderyVisibility", () => ({
  measureBrandVisibility: measureBrandVisibilityMock,
}));
vi.mock("@/server/lib/r2-cache", () => cacheMock);

import { getBrandLookup } from "./brandLookup";
import { brandLookupSearchSchema } from "@/types/schemas/ai-search";
import type { OrganizationContext } from "@/server/auth/organizationContext";

const billingCustomer: OrganizationContext = {
  organizationId: "org_123",
  userId: "user_123",
  userEmail: "alice@example.com",
};

const input = {
  projectId: "project_123",
  query: "acme.com",
  competitors: [],
  locationCode: 2840,
  languageCode: "en",
};

beforeEach(() => {
  cacheMock.getCached.mockResolvedValue(null);
});

describe("getBrandLookup", () => {
  it("reports an unmeasurable target as no data, never as zero mentions", async () => {
    measureBrandVisibilityMock.mockResolvedValue({
      status: "unavailable",
      kind: "unrecognised",
      reason: "Our model does not recognise acme.com.",
    });

    const result = await getBrandLookup(input, billingCustomer);

    expect(result.totalMentions).toBeNull();
    expect(result.hasData).toBe(false);
    // A result we never obtained must not be frozen for a day.
    expect(cacheMock.setCached).not.toHaveBeenCalled();
  });

  it("surfaces a broken probe run as an error the user can retry", async () => {
    measureBrandVisibilityMock.mockResolvedValue({
      status: "unavailable",
      kind: "probe_failed",
      reason: "Every probe to our own model failed.",
    });

    await expect(getBrandLookup(input, billingCustomer)).rejects.toThrow(
      "Every probe to our own model failed.",
    );
  });

  it("reports only the measured count, leaving aggregate fields absent", async () => {
    measureBrandVisibilityMock.mockResolvedValue({
      status: "measured",
      modelName: "gpt-oss-120b",
      category: "seo tools",
      probes: [],
      mentionedCount: 2,
      probeCount: 6,
      mentionRatePct: 33.3,
    });

    const result = await getBrandLookup(input, billingCustomer);

    expect(result).toMatchObject({
      hasData: true,
      totalMentions: 2,
      // No free source can produce a market-wide aggregate from one model call.
      totalAiSearchVolume: null,
      shareOfVoice: null,
      perPlatform: [],
      topPages: [],
      topQueries: [],
      monthlyVolume: [],
    });
  });
});

describe("brandLookupSearchSchema — `c` competitor param", () => {
  it("parses a raw comma-separated string from the URL", () => {
    expect(brandLookupSearchSchema.parse({ c: "nike, adidas" }).c).toEqual([
      "nike",
      "adidas",
    ]);
  });

  it("accepts an already-parsed array (TanStack re-validates its own output)", () => {
    // navigate() feeds the previous transformed output (a string[]) back through
    // validateSearch — this must not throw "expected string, received array".
    expect(brandLookupSearchSchema.parse({ c: ["nike", "adidas"] }).c).toEqual([
      "nike",
      "adidas",
    ]);
  });

  it("dedupes and caps at 5 regardless of input form", () => {
    const many = ["a", "a", "b", "c", "d", "e", "f"];
    expect(brandLookupSearchSchema.parse({ c: many }).c).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("leaves `c` undefined when absent", () => {
    expect(brandLookupSearchSchema.parse({}).c).toBeUndefined();
  });
});
