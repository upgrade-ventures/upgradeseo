import { describe, expect, it, vi } from "vitest";
import {
  aggregateGscPositions,
  bingPositionsByQuery,
  buildSnapshotRows,
  freeRankNotice,
  gscPropertyCoversDomain,
  runFreeRankCheck,
} from "./freeRankSource";

// Only the three modules the check reaches out through. No DB, no HTTP.
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getConnection: vi.fn(async () => null) },
}));
vi.mock("@/server/features/provider-keys/providerKeys", () => ({
  // No Bing key stored — the state that used to make Bright Data unreachable.
  resolveProviderKey: vi.fn(async (_org: string, provider: string) =>
    provider === "brightdata"
      ? { secret: "token", publicIdentifier: "zone" }
      : null,
  ),
}));
// Keep the real parser and positionOf; only the network client is stubbed.
vi.mock("@/server/lib/free-seo/brightdata", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createBrightDataClient: vi.fn(() => ({
    search: vi.fn(async () => [
      {
        position: 4,
        url: "https://example.com/pricing",
        domain: "example.com",
        title: "Pricing",
      },
    ]),
  })),
}));

const row = (
  keys: string[],
  position: number,
  impressions: number,
): {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
} => ({
  keys,
  clicks: 0,
  impressions,
  ctr: 0,
  position,
});

describe("gscPropertyCoversDomain", () => {
  it("covers subdomains for a domain property but not for a URL-prefix one", () => {
    expect(gscPropertyCoversDomain("sc-domain:acme.com", "blog.acme.com")).toBe(
      true,
    );
    expect(gscPropertyCoversDomain("https://acme.com/", "blog.acme.com")).toBe(
      false,
    );
    expect(gscPropertyCoversDomain("https://www.acme.com/", "acme.com")).toBe(
      true,
    );
  });

  it("rejects a lookalike domain that merely ends with the property name", () => {
    // notacme.com endsWith "acme.com" as a string; only a dot-boundary match
    // is a real subdomain, and reporting one site's positions under another
    // site's name is the failure this guards.
    expect(gscPropertyCoversDomain("sc-domain:acme.com", "notacme.com")).toBe(
      false,
    );
  });
});

describe("aggregateGscPositions", () => {
  it("weights a query's pages by impressions and keeps the busiest page", () => {
    const positions = aggregateGscPositions(
      [
        row(["seo tools", "https://acme.com/a", "DESKTOP"], 10, 90),
        row(["seo tools", "https://acme.com/b", "DESKTOP"], 20, 10),
      ],
      "acme.com",
    );

    expect(positions.get("seo tools|desktop")).toEqual({
      position: 11,
      url: "https://acme.com/a",
    });
  });

  it("drops other hosts on the property and devices with no column", () => {
    const positions = aggregateGscPositions(
      [
        row(["seo tools", "https://other.com/a", "DESKTOP"], 3, 100),
        row(["seo tools", "https://acme.com/a", "TABLET"], 4, 100),
      ],
      "acme.com",
    );

    expect(positions.size).toBe(0);
  });
});

describe("buildSnapshotRows", () => {
  it("skips keywords with no data instead of writing a missing position", () => {
    const rows = buildSnapshotRows({
      keywords: [
        { id: "kw_1", keyword: "seo tools" },
        { id: "kw_2", keyword: "rank tracker" },
      ],
      devices: ["desktop", "mobile"],
      positions: new Map([
        ["seo tools|desktop", { position: 4.6, url: "https://acme.com/a" }],
      ]),
    });

    expect(rows).toEqual([
      {
        trackingKeywordId: "kw_1",
        keyword: "seo tools",
        device: "desktop",
        position: 5,
        url: "https://acme.com/a",
      },
    ]);
  });
});

describe("freeRankNotice", () => {
  // The labelling is the product promise here: a window average must never be
  // read as a live SERP check, and a Bing position must never be read as
  // Google's.
  it("names Search Console and the window, and never calls it live", () => {
    const notice = freeRankNotice({
      source: "gsc_average_position",
      subject: "sc-domain:acme.com",
      devices: ["desktop"],
      keywordsWithoutData: 0,
    });

    expect(notice).toContain("Search Console");
    expect(notice).toContain("not a live SERP check");
  });

  it("names Bing, denies Google, and explains the missing device split", () => {
    const notice = freeRankNotice({
      source: "bing_average_impression_position",
      subject: "acme.com",
      devices: ["desktop", "mobile"],
      keywordsWithoutData: 2,
    });

    expect(notice).toContain("BING positions, not Google");
    expect(notice).toContain("no device split");
    expect(notice).toContain("2 keyword(s) had no data");
  });
});

describe("bingPositionsByQuery", () => {
  it("keys positions by lowercased query and drops unusable rows", () => {
    const positions = bingPositionsByQuery([
      { Query: "SEO Tools", AvgImpressionPosition: 7.4 },
      { Query: "", AvgImpressionPosition: 2 },
      { Query: "broken", AvgImpressionPosition: Number.NaN },
    ]);

    expect(positions).toEqual(new Map([["seo tools", 7.4]]));
  });
});

describe("runFreeRankCheck source fallback", () => {
  it("reaches Bright Data when no Bing key is stored", async () => {
    // Regression: tryBingPositions throws DATA_SOURCE_NOT_CONFIGURED when Bing
    // is absent, and that throw escaped the chain, so the one source able to
    // report an unverified domain was dead code precisely when it was needed.
    const result = await runFreeRankCheck({
      projectId: "p1",
      organizationId: "o1",
      domain: "example.com",
      locationCode: 2840,
      devices: "mobile",
      keywords: [{ id: "k1", keyword: "pricing" }],
    });

    expect(result?.source).toBe("brightdata_live_serp");
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows[0]?.position).toBe(4);
  });
});
