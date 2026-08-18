import { describe, expect, it, vi } from "vitest";

import {
  buildCompetitorFootprint,
  footprintPhrases,
  inferTargetMarkets,
  isContentUrl,
} from "@/server/lib/free-seo/competitor-footprint";
import {
  createCommonCrawlClient,
  extractHttpBody,
  type CdxRecord,
} from "@/server/lib/free-seo/commoncrawl";
import {
  extractPageTerms,
  slugPhrase,
  type PageTerms,
} from "@/server/lib/free-seo/page-terms";
import {
  gscCountryFor,
  languageTargetsMarket,
  marketFor,
} from "@/server/lib/free-seo/markets";

describe("markets", () => {
  it("gives each market its three different identifiers", () => {
    const riyadh = marketFor(2682);
    expect(riyadh.bingCountry).toBe("sa");
    expect(riyadh.bingLanguage).toBe("ar-SA");
    // Search Console is the only alpha-3 consumer in the app.
    expect(riyadh.gscCountry).toBe("sau");
    expect(gscCountryFor(2788)).toBe("tun");
  });

  it("flags an unmapped market as inexact instead of throwing", () => {
    expect(marketFor(9999).exact).toBe(false);
    expect(marketFor(9999).bingCountry).toBe("us");
  });

  it("matches language across the two coding schemes in play", () => {
    // Common Crawl's 639-3, multilingual form.
    expect(languageTargetsMarket("ara,eng", 2682)).toBe(true);
    // A page's own <html lang>, 639-1 with a region.
    expect(languageTargetsMarket("ar-AE", 2682)).toBe(true);
    expect(languageTargetsMarket("fr", 2788)).toBe(true);
    expect(languageTargetsMarket("tur", 2682)).toBe(false);
    expect(languageTargetsMarket(null, 2682)).toBe(false);
  });
});

describe("page terms", () => {
  it("reads the fields a competitor chose deliberately", () => {
    const terms = extractPageTerms(`
      <html lang="en">
        <head>
          <title>MassLight - Capital and Tech Team for Equity</title>
          <meta name="description" content="We invest capital and engineers." />
          <link rel="alternate" hreflang="ar-AE" href="/ar" />
          <link rel="alternate" hreflang="x-default" href="/" />
        </head>
        <body><h1>We invest capital and engineers, in exchange for equity.</h1></body>
      </html>`);

    expect(terms.title).toBe("MassLight - Capital and Tech Team for Equity");
    expect(terms.h1[0]).toBe(
      "We invest capital and engineers, in exchange for equity.",
    );
    expect(terms.lang).toBe("en");
    // x-default declares a fallback, not a market, so it must not appear.
    expect(terms.hreflang).toEqual(["ar-ae"]);
  });

  it("ignores markup hidden inside script blocks", () => {
    const terms = extractPageTerms(
      `<script>var t = "<h1>not a heading</h1>";</script><h1>real</h1>`,
    );
    expect(terms.h1).toEqual(["real"]);
  });

  it("reads meta description regardless of attribute order", () => {
    const reversed = extractPageTerms(
      `<meta content="reversed order" name="description">`,
    );
    expect(reversed.metaDescription).toBe("reversed order");
  });

  it("turns a slug into a phrase and rejects pagination segments", () => {
    expect(slugPhrase("https://masslight.com/build-for-equity-faq")).toBe(
      "build for equity faq",
    );
    expect(slugPhrase("https://a.com/posts/2")).toBeNull();
    expect(slugPhrase("https://a.com/")).toBeNull();
  });
});

const cdxRecord = (over: Partial<CdxRecord> = {}): CdxRecord => ({
  url: "https://masslight.com/about-us",
  status: "200",
  languages: "eng",
  filename: "crawl/x.warc.gz",
  offset: "100",
  length: "50",
  ...over,
});

const cdxLine = (over: Partial<CdxRecord> = {}) =>
  JSON.stringify(cdxRecord(over));

describe("Common Crawl client", () => {
  it("never sends a wildcard url, which is the documented 504", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(cdxLine()),
    );
    const cc = createCommonCrawlClient({ fetchImpl });
    await cc.domainUrls({
      domain: "masslight.com",
      crawlId: "CC-MAIN-2026-30",
    });

    const [requested] = fetchImpl.mock.calls[0] ?? [];
    const url = typeof requested === "string" ? requested : "";
    expect(url).toContain("matchType=domain");
    expect(url).not.toContain("*");
  });

  it("separates a failed query from a genuinely empty one", async () => {
    // A 504 must not read as "this competitor has no pages".
    const failing = createCommonCrawlClient({
      fetchImpl: vi.fn(async () => new Response("", { status: 504 })),
      sleepImpl: async () => {},
    });
    expect(
      await failing.domainUrls({ domain: "a.com", crawlId: "c" }),
    ).toBeNull();

    const empty = createCommonCrawlClient({
      fetchImpl: vi.fn(async () => new Response("", { status: 404 })),
    });
    expect(await empty.domainUrls({ domain: "a.com", crawlId: "c" })).toEqual(
      [],
    );
  });

  it("retries a 504 and succeeds, because half of live calls fail", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls < 3
        ? new Response("", { status: 504 })
        : new Response(cdxLine());
    });
    const cc = createCommonCrawlClient({
      fetchImpl,
      sleepImpl: async () => {},
    });
    const rows = await cc.domainUrls({ domain: "a.com", crawlId: "c" });
    expect(rows).toHaveLength(1);
    expect(calls).toBe(3);
  });

  it("does not retry a 404, which is a real answer", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const cc = createCommonCrawlClient({
      fetchImpl,
      sleepImpl: async () => {},
    });
    await cc.domainUrls({ domain: "a.com", crawlId: "c" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps the good rows when one line is malformed", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          `${cdxLine()}\nnot json\n${cdxLine({ url: "https://masslight.com/x" })}`,
        ),
    );
    const cc = createCommonCrawlClient({ fetchImpl });
    const rows = await cc.domainUrls({ domain: "masslight.com", crawlId: "c" });
    expect(rows).toHaveLength(2);
  });

  it("refuses a WARC response that ignored the Range header", async () => {
    // A 200 means we are about to read the whole multi-GB file.
    const fetchImpl = vi.fn(async () => new Response("body", { status: 200 }));
    const cc = createCommonCrawlClient({ fetchImpl });
    expect(await cc.fetchWarcRecord(cdxRecord())).toBeNull();
  });

  it("strips WARC and HTTP headers, leaving the page body", () => {
    const raw =
      "WARC/1.0\r\nWARC-Type: response\r\n\r\n" +
      "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n" +
      "<html><title>kept</title></html>";
    expect(extractHttpBody(raw)).toBe("<html><title>kept</title></html>");
  });
});

const page = (
  over: Partial<{ languages: string | null; url: string }> = {},
) => ({
  url: over.url ?? "https://a.com/x",
  languages: over.languages === undefined ? "eng" : over.languages,
  slug: "x" as string | null,
  terms: null as PageTerms | null,
  source: "commoncrawl" as const,
});

describe("competitor footprint", () => {
  it("infers a Gulf market from Arabic pages", () => {
    // This is the real antler.co signal: 11 "ara,eng" pages.
    const markets = inferTargetMarkets([page({ languages: "ara,eng" })]);
    expect(markets).toContain(2682); // Saudi Arabia
    expect(markets).not.toContain(2792); // Türkiye
  });

  it("does not read an all-English site as targeting every English market", () => {
    // Regression: masslight.com is a US consultancy publishing only English.
    // Matching on "eng" made it look like it targeted Amman, Riyadh, Dubai
    // and Bangalore simultaneously, which is a false claim about a competitor.
    const markets = inferTargetMarkets([page({ languages: "eng" })]);
    expect(markets).not.toContain(2400); // Jordan
    expect(markets).not.toContain(2682); // Saudi Arabia
    expect(markets).not.toContain(2784); // UAE
    expect(markets).not.toContain(2356); // India
  });

  it("accepts an explicit hreflang even for an English market", () => {
    // hreflang is a publisher declaration, so it beats language inference.
    const withHreflang = {
      ...page({ languages: "eng" }),
      terms: {
        title: null,
        metaDescription: null,
        h1: [],
        h2: [],
        hreflang: ["en-ae"],
        lang: "en",
      },
    };
    expect(inferTargetMarkets([withHreflang])).toContain(2784); // UAE
  });

  it("reports a Common Crawl failure as unavailable, not as zero pages", async () => {
    const client = {
      latestCrawlId: async () => "CC-MAIN-2026-30",
      domainUrls: async () => null,
      fetchWarcRecord: async () => null,
    };
    const result = await buildCompetitorFootprint("a.com", { client });
    expect(result.unavailable).toBe(true);
    expect(result.pages).toEqual([]);
  });

  it("flags a full-to-the-limit result as truncated", async () => {
    // Regression: CDX truncates in sorted URL order, not randomly. On
    // antler.co, limit=200 returned 100% English and zero Arabic pages, while
    // limit=1000 returned 11 "ara,eng". A clipped inventory therefore makes a
    // competitor look like it targets no market, so callers must be told.
    const rows = Array.from({ length: 3 }, (_, i) => ({
      url: `https://a.com/${i}`,
      status: "200",
      languages: "eng",
    }));
    const client = {
      latestCrawlId: async () => "c",
      domainUrls: async () => rows,
      fetchWarcRecord: async () => null,
    };
    const clipped = await buildCompetitorFootprint("a.com", {
      client,
      limit: 3,
    });
    expect(clipped.truncated).toBe(true);

    const complete = await buildCompetitorFootprint("a.com", {
      client,
      limit: 50,
    });
    expect(complete.truncated).toBe(false);
  });

  it("excludes assets and robots.txt from the page set", () => {
    // Regression: a live antler.co run ranked "robots.txt" as its top
    // targeted phrase with 9 hits.
    expect(isContentUrl("https://a.com/robots.txt")).toBe(false);
    expect(isContentUrl("https://a.com/sitemap.xml")).toBe(false);
    expect(isContentUrl("https://a.com/logo.svg")).toBe(false);
    expect(isContentUrl("https://a.com/wp-json/v2/posts")).toBe(false);
    expect(isContentUrl("https://a.com/build-for-equity")).toBe(true);
    expect(isContentUrl("https://a.com/")).toBe(true);
  });

  it("drops non-200 rows and www duplicates", async () => {
    const client = {
      latestCrawlId: async () => "c",
      domainUrls: async () => [
        { url: "https://www.a.com/about", status: "200", languages: "eng" },
        { url: "https://a.com/about", status: "200", languages: "eng" },
        { url: "https://a.com/gone", status: "404", languages: "eng" },
      ],
      fetchWarcRecord: async () => null,
    };
    const result = await buildCompetitorFootprint("a.com", { client });
    expect(result.pages).toHaveLength(1);
    expect(result.unavailable).toBe(false);
  });

  it("drops navigation chrome that appears on most pages", () => {
    // Regression: a live run put "menu", "about us" and "contact us" at the
    // top of masslight.com's targeted terms. They are header links.
    const withTerms = (url: string, title: string) => ({
      ...page({ url }),
      slug: null,
      terms: {
        title,
        metaDescription: null,
        h1: ["Menu"],
        h2: [],
        hreflang: [],
        lang: "en",
      },
    });
    const phrases = footprintPhrases({
      domain: "a.com",
      crawlId: "c",
      unavailable: false,
      truncated: false,
      targetsMarkets: [],
      pages: [
        withTerms("https://a.com/1", "build for equity"),
        withTerms("https://a.com/2", "beta testing guide"),
        withTerms("https://a.com/3", "funding options"),
        withTerms("https://a.com/4", "agile business"),
        withTerms("https://a.com/5", "hiring engineers"),
      ],
    });
    // "menu" is on 5 of 5 pages; every title is on exactly 1.
    expect(phrases.map((p) => p.phrase)).not.toContain("menu");
    expect(phrases.map((p) => p.phrase)).toContain("build for equity");
  });

  it("keeps everything when there is too little content to judge", () => {
    // With 2 pages, "on most pages" means nothing; suppressing here would
    // silently hide real terms for small competitors.
    const one = {
      ...page({ url: "https://a.com/1" }),
      slug: null,
      terms: {
        title: "menu",
        metaDescription: null,
        h1: [],
        h2: [],
        hreflang: [],
        lang: "en",
      },
    };
    const phrases = footprintPhrases({
      domain: "a.com",
      crawlId: "c",
      unavailable: false,
      truncated: false,
      targetsMarkets: [],
      pages: [one],
    });
    expect(phrases.map((p) => p.phrase)).toContain("menu");
  });

  it("ranks repeated phrases first and carries an evidence URL", () => {
    const phrases = footprintPhrases({
      domain: "a.com",
      crawlId: "c",
      unavailable: false,
      truncated: false,
      targetsMarkets: [],
      pages: [
        { ...page({ url: "https://a.com/1" }), slug: "build for equity" },
        { ...page({ url: "https://a.com/2" }), slug: "build for equity" },
        { ...page({ url: "https://a.com/3" }), slug: "hiring" },
      ],
    });
    expect(phrases[0]).toEqual({
      phrase: "build for equity",
      count: 2,
      // First page that produced the phrase, so a human can go check it.
      evidenceUrl: "https://a.com/1",
    });
  });
});
