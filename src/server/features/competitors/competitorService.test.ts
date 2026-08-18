import { describe, expect, it, vi } from "vitest";

import {
  normaliseCompetitorDomain,
  PAGE_INSERT_LIMITS,
} from "@/server/features/competitors/competitorService";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({
  competitorProfiles: {},
  competitorPages: {},
}));

describe("competitor domain normalisation", () => {
  it("reduces every form of the same site to one key", () => {
    // Without this, "antler.co" and "https://www.Antler.co/about" would be
    // stored as two competitors and harvested twice.
    const expected = "antler.co";
    expect(normaliseCompetitorDomain("antler.co")).toBe(expected);
    expect(normaliseCompetitorDomain("https://www.Antler.co/about")).toBe(
      expected,
    );
    expect(normaliseCompetitorDomain("  WWW.ANTLER.CO  ")).toBe(expected);
  });

  it("returns empty for input that is not a domain", () => {
    expect(normaliseCompetitorDomain("")).toBe("");
    expect(normaliseCompetitorDomain("   ")).toBe("");
    // Callers reject "" rather than storing a junk row.
    expect(normaliseCompetitorDomain("http://")).toBe("");
  });
});

describe("page insert batching", () => {
  it("stays within D1's bound-parameter budget", () => {
    // Regression: batching by ROWS (100) bound 700 variables per statement and
    // every harvest died with "D1_ERROR: too many SQL variables". The budget is
    // parameters, not rows.
    const boundPerStatement =
      PAGE_INSERT_LIMITS.batch * PAGE_INSERT_LIMITS.columns;
    expect(boundPerStatement).toBeLessThanOrEqual(
      PAGE_INSERT_LIMITS.maxBoundParams,
    );
    expect(PAGE_INSERT_LIMITS.batch).toBeGreaterThan(0);
  });
});
