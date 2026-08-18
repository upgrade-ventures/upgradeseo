import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: vi.fn(async () => undefined),
}));
vi.mock("@/server/features/provider-keys/providerKeys", () => ({
  resolveProviderKey: vi.fn(async () => null),
}));

import { resolveProviderKey } from "@/server/features/provider-keys/providerKeys";
import {
  applyFreeKeywordQuery,
  applyFreePageQuery,
  tryFreeDomainKeywords,
  type FreeDomainKeywordRow,
} from "./freeDomainOverview";

const row = (
  keyword: string,
  searchVolume: number | null,
  cpc: number | null = null,
): FreeDomainKeywordRow => ({
  keyword,
  position: null,
  searchVolume,
  traffic: null,
  cpc,
  url: null,
  relativeUrl: null,
  keywordDifficulty: null,
});

const noFilters = {
  filters: {},
  sortMode: "volume",
  sortOrder: "desc",
} as const;

describe("applyFreeKeywordQuery", () => {
  it("orders by volume with unknown volumes last, never as zero", () => {
    const result = applyFreeKeywordQuery(
      [row("b", null), row("a", 50), row("c", 900)],
      noFilters,
    );

    expect(result.rows.map((r) => r.keyword)).toEqual(["c", "a", "b"]);
    expect(result.rows.map((r) => r.searchVolume)).toEqual([900, 50, null]);
  });

  it("falls back to volume order and says so when the sort column is unavailable", () => {
    const result = applyFreeKeywordQuery([row("a", 10), row("b", 90)], {
      filters: {},
      sortMode: "rank",
      sortOrder: "asc",
    });

    expect(result.rows.map((r) => r.keyword)).toEqual(["b", "a"]);
    expect(result.unavailable.sort).toContain("Sorted by search volume");
    expect(result.unavailable.position).toBeTruthy();
    expect(result.unavailable.traffic).toBeTruthy();
  });

  it("keeps unknown volumes last when the user sorts ascending", () => {
    const result = applyFreeKeywordQuery(
      [row("b", null), row("c", 900), row("a", 50)],
      { filters: {}, sortMode: "volume", sortOrder: "asc" },
    );

    expect(result.rows.map((r) => r.keyword)).toEqual(["a", "c", "b"]);
  });

  it("applies the filters it can and reports the ones it cannot", () => {
    const rows = [row("cheap shoes", 400, 1.2), row("shoe repair", 90, 0.4)];

    const result = applyFreeKeywordQuery(rows, {
      filters: { include: "shoes", minVol: 100, minRank: 5 },
      sortMode: "volume",
      sortOrder: "desc",
    });

    expect(result.rows.map((r) => r.keyword)).toEqual(["cheap shoes"]);
    expect(result.unavailable.filters).toContain("were not applied");
  });
});

describe("applyFreePageQuery", () => {
  it("orders by URL and reports that traffic sorting is unavailable", () => {
    const pages = [
      {
        page: "https://x.com/b",
        relativePath: "/b",
        organicTraffic: null,
        keywords: null,
      },
      {
        page: "https://x.com/a",
        relativePath: "/a",
        organicTraffic: null,
        keywords: null,
      },
    ] as const;

    const result = applyFreePageQuery([...pages], { filters: {} });

    expect(result.rows.map((r) => r.relativePath)).toEqual(["/a", "/b"]);
    expect(result.unavailable.sort).toContain("Sorted by URL");
  });
});

describe("free-mode routing", () => {
  it("asks the user to connect Google Ads instead of failing opaquely", async () => {
    await expect(
      tryFreeDomainKeywords({
        domain: "example.com",
        locationCode: 2840,
        organizationId: "org_1",
      }),
    ).rejects.toMatchObject({ code: "DATA_SOURCE_NOT_CONFIGURED" });
  });

  it("treats a stored but unusable Google Ads key as not connected", async () => {
    // No customer id, so the provider builds no client and would otherwise
    // return zero keyword ideas, which reads as "this domain targets nothing".
    vi.mocked(resolveProviderKey).mockImplementation(async (_org, provider) =>
      provider === "google_ads"
        ? {
            secret: JSON.stringify({
              developerToken: "t",
              clientId: "c",
              clientSecret: "s",
              refreshToken: "r",
            }),
            publicIdentifier: null,
          }
        : null,
    );

    await expect(
      tryFreeDomainKeywords({
        domain: "example.com",
        locationCode: 2840,
        organizationId: "org_1",
      }),
    ).rejects.toMatchObject({ code: "DATA_SOURCE_NOT_CONFIGURED" });
  });
});
