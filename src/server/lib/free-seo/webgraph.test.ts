import { describe, expect, it, vi } from "vitest";

import {
  fetchAhrefsDomainRating,
  fetchBingInboundLinks,
  fetchOpenPageRankBulk,
  parseBingLinkCounts,
} from "./webgraph";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchOpenPageRankBulk", () => {
  it("declines a legacy v1.0 key so the caller can fall back", async () => {
    const fetchImpl = vi.fn();

    expect(
      await fetchOpenPageRankBulk({
        apiKey: "0123456789abcdef0123456789abcdef",
        domains: ["example.com"],
        fetchImpl,
      }),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("scales authority to 0-100 and keeps unknown domains null, not zero", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        results: [
          {
            domain: "github.com",
            found: true,
            open_page_rank: 9.67,
            referring_domains: 282833,
            history: [{ date: "2026-06-01", open_page_rank: 9.6 }],
          },
          {
            domain: "brand-new.example",
            found: false,
            open_page_rank: 0,
            referring_domains: 0,
          },
        ],
      }),
    );

    const result = await fetchOpenPageRankBulk({
      apiKey: "opr_live_abc",
      domains: ["github.com", "brand-new.example"],
      includeHistory: true,
      fetchImpl,
    });

    expect(result?.get("github.com")).toEqual({
      domain: "github.com",
      authorityRankProxy: 96.7,
      referringDomains: 282833,
      history: [{ date: "2026-06-01", authorityRankProxy: 96 }],
    });
    expect(result?.get("brand-new.example")).toEqual({
      domain: "brand-new.example",
      authorityRankProxy: null,
      referringDomains: null,
      history: [],
    });
  });
});

describe("fetchAhrefsDomainRating", () => {
  it("reads an unrated domain as null rather than a rating of zero", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ domain_rating: { domain_rating: 0 } }),
    );

    expect(
      await fetchAhrefsDomainRating({
        domain: "brand-new.example",
        fetchImpl,
      }),
    ).toBeNull();
  });
});

describe("parseBingLinkCounts", () => {
  it("reads the documented payload and only claims a complete list on one page", () => {
    expect(
      parseBingLinkCounts({
        Links: [{ Url: "https://example.com/a", Count: 14 }],
        TotalPages: 1,
      }),
    ).toEqual({
      pages: [{ url: "https://example.com/a", inboundLinks: 14 }],
      complete: true,
    });

    expect(
      parseBingLinkCounts({
        Links: [{ Url: "https://example.com/a", Count: 14 }],
        TotalPages: 3,
      }).complete,
    ).toBe(false);
  });

  // free-seo/bing.ts types the same value as a flat array, so both shapes have
  // to survive; an unknown page count must not be read as "we hold it all".
  it("reads the flat array shape and treats an unknown page count as partial", () => {
    expect(
      parseBingLinkCounts([{ Url: "https://example.com/a", LinkCount: 3 }]),
    ).toEqual({
      pages: [{ url: "https://example.com/a", inboundLinks: 3 }],
      complete: false,
    });
  });
});

describe("fetchBingInboundLinks", () => {
  it("returns null when Bing refuses a site this key has not verified", async () => {
    const fetchImpl = vi.fn(async () => new Response("fault", { status: 400 }));

    expect(
      await fetchBingInboundLinks({
        apiKey: "key",
        siteUrl: "https://competitor.com/",
        pageUrl: "https://competitor.com/pricing",
        fetchImpl,
      }),
    ).toBeNull();
  });

  it("collects anchor text across Bing's pages and stops at TotalPages", async () => {
    let page = 0;
    const fetchImpl = vi.fn(async () => {
      page += 1;
      return jsonResponse({
        d: {
          Details: [
            { AnchorText: `anchor ${page}`, Url: `https://ref${page}.com/x` },
          ],
          TotalPages: 2,
        },
      });
    });

    const links = await fetchBingInboundLinks({
      apiKey: "key",
      siteUrl: "https://example.com/",
      pageUrl: "https://example.com/guide",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(links).toEqual([
      {
        urlFrom: "https://ref1.com/x",
        urlTo: "https://example.com/guide",
        anchor: "anchor 1",
      },
      {
        urlFrom: "https://ref2.com/x",
        urlTo: "https://example.com/guide",
        anchor: "anchor 2",
      },
    ]);
  });
});
