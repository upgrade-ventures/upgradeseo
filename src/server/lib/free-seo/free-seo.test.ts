import { describe, expect, it, vi } from "vitest";

import { createBingClient, defaultWindow } from "@/server/lib/free-seo/bing";
import {
  createOpenPageRankClient,
  normaliseDomain,
} from "@/server/lib/free-seo/openpagerank";
import { estimateDifficulty } from "@/server/lib/free-seo/difficulty";
import {
  bingMarketFor,
  bingRowsToEnriched,
  createFreeSeoProvider,
  isFreeMode,
  relatedRowsMatchingSeed,
} from "@/server/lib/free-seo/provider";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Bing Webmaster client", () => {
  it("calls the JSON endpoint, never the retiring POX path", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ d: [] }),
    );
    const bing = createBingClient({ apiKey: "k", fetchImpl });
    await bing.relatedKeywords({
      query: "technical cofounder",
      country: "us",
      language: "en-US",
      startDate: "2026-07-01",
      endDate: "2026-08-01",
    });
    const [requested] = fetchImpl.mock.calls[0] ?? [];
    const url = typeof requested === "string" ? requested : "";
    // Microsoft retires /pox/ and SOAP on 2026-08-31; only /json/ survives.
    expect(url).toContain("/webmaster/api.svc/json/GetRelatedKeywords");
    expect(url).not.toContain("/pox/");
  });

  it("unwraps Bing's `d` envelope and tolerates a single object", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        d: { Query: "seo", Impressions: 120, BroadImpressions: 400 },
      }),
    );
    const bing = createBingClient({ apiKey: "k", fetchImpl });
    const row = await bing.keyword({
      query: "seo",
      country: "us",
      language: "en-US",
      startDate: "2026-07-01",
      endDate: "2026-08-01",
    });
    expect(row?.Impressions).toBe(120);
  });

  it("treats `d: null` as no data rather than throwing", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ d: null }));
    const bing = createBingClient({ apiKey: "k", fetchImpl });
    expect(
      await bing.keyword({
        query: "nonexistent",
        country: "us",
        language: "en-US",
        startDate: "2026-07-01",
        endDate: "2026-08-01",
      }),
    ).toBeNull();
  });

  it("never puts the api key in an error message", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }, 401));
    const bing = createBingClient({ apiKey: "SECRET-KEY", fetchImpl });
    await expect(
      bing.relatedKeywords({
        query: "x",
        country: "us",
        language: "en-US",
        startDate: "2026-07-01",
        endDate: "2026-08-01",
      }),
    ).rejects.toThrow(/HTTP 401/);
    await expect(
      bing.relatedKeywords({
        query: "x",
        country: "us",
        language: "en-US",
        startDate: "2026-07-01",
        endDate: "2026-08-01",
      }),
    ).rejects.not.toThrow(/SECRET-KEY/);
  });

  it("defaults to a trailing 30-day window", () => {
    const w = defaultWindow(new Date("2026-08-15T00:00:00Z"));
    expect(w.endDate).toBe("2026-08-15");
    expect(w.startDate).toBe("2026-07-16");
  });
});

describe("OpenPageRank client", () => {
  it("normalises URLs and www to bare hostnames", () => {
    expect(normaliseDomain("https://www.Example.com/path?x=1")).toBe(
      "example.com",
    );
    expect(normaliseDomain("upgrade.ventures")).toBe("upgrade.ventures");
    expect(normaliseDomain("   ")).toBe("");
  });

  it("batches past the 100-domain per-request cap instead of truncating", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ results: [] }));
    const opr = createOpenPageRankClient({ apiKey: "k", fetchImpl });
    await opr.authority(Array.from({ length: 250 }, (_, i) => `site${i}.com`));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("reads an unknown domain as null authority, not zero", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        // Shape of the Keywords Everywhere host: `results`, `open_page_rank`,
        // and an explicit `found` flag for domains absent from the web graph.
        results: [
          {
            domain: "strong.com",
            found: true,
            open_page_rank: 7.4,
            rank: "1200",
          },
          {
            domain: "unknown.com",
            found: false,
            open_page_rank: 0,
            rank: null,
          },
        ],
      }),
    );
    const opr = createOpenPageRankClient({ apiKey: "k", fetchImpl });
    const rows = await opr.authority(["strong.com", "unknown.com"]);
    expect(rows[0]?.pageRank).toBe(7.4);
    expect(rows[0]?.globalRank).toBe(1200);
    // A domain OpenPageRank has never seen must not read as "zero authority",
    // which would make a hard keyword look easy.
    expect(rows[1]?.pageRank).toBeNull();
  });
});

describe("difficulty proxy", () => {
  it("scores a strong SERP high and a weak one low", () => {
    const strong = estimateDifficulty([
      { domain: "a.com", pageRank: 8, globalRank: 100 },
      { domain: "b.com", pageRank: 7, globalRank: 200 },
    ]);
    const weak = estimateDifficulty([
      { domain: "c.com", pageRank: 2, globalRank: 900000 },
      { domain: "d.com", pageRank: 1.5, globalRank: 990000 },
    ]);
    expect(strong?.score).toBe(75);
    expect(weak?.score).toBe(18);
    expect(strong?.score).toBeGreaterThan(weak!.score);
  });

  it("returns null when no authority is known, never a misleading zero", () => {
    expect(
      estimateDifficulty([
        { domain: "x.com", pageRank: null, globalRank: null },
      ]),
    ).toBeNull();
  });

  it("labels itself a proxy so it is never quoted as a vendor score", () => {
    const est = estimateDifficulty([
      { domain: "a.com", pageRank: 5, globalRank: 1 },
    ]);
    expect(est?.method).toBe("authority-proxy");
    expect(est?.basis).toContain("not a vendor difficulty score");
    expect(est?.sampleSize).toBe(1);
  });
});

describe("free provider routing", () => {
  it("is configured once any keyword source is connected", () => {
    expect(isFreeMode({ MICROSOFT_ADS_CREDENTIALS: "{}" })).toBe(true);
    expect(isFreeMode({ GOOGLE_ADS_CREDENTIALS: "{}" })).toBe(true);
    expect(isFreeMode({ BING_WEBMASTER_API_KEY: "y" })).toBe(true);
    // Nothing connected is the one case that is not configured.
    expect(isFreeMode({})).toBe(false);
  });

  it("routes volume to Microsoft when it is the only source connected", () => {
    // The regression this guards: Microsoft was registered, implemented and
    // ranked first, but no call site passed its credential, so a saved key
    // produced `available: false` and the UI kept asking for a source the user
    // had already connected.
    const provider = createFreeSeoProvider({
      MICROSOFT_ADS_CREDENTIALS: JSON.stringify({
        developerToken: "dev",
        accessToken: "tok",
      }),
      // "customerId|accountId" — a bare id does not parse, and the provider
      // then silently reports unavailable.
      MICROSOFT_ADS_ACCOUNT: "111|222",
    });
    expect(provider.available).toBe(true);
    expect(provider.volumeSource).toBe("microsoft_ads");
  });

  it("maps the focus markets to Bing country/language pairs", () => {
    expect(bingMarketFor(2400)).toEqual({
      country: "jo",
      language: "en-US",
      exact: true,
    });
    // Tunis is a French-first market — the persona research made that binding.
    expect(bingMarketFor(2788).language).toBe("fr-FR");
    // Almaty is Russian-first.
    expect(bingMarketFor(2398).language).toBe("ru-RU");
  });

  it("falls back to US for an unmapped market but flags it as inexact", () => {
    const m = bingMarketFor(9999);
    expect(m.country).toBe("us");
    expect(m.exact).toBe(false);
  });

  it("leaves unsourceable fields NULL rather than zero", () => {
    const [row] = bingRowsToEnriched([
      { Query: "technical cofounder", Impressions: 90, BroadImpressions: 300 },
    ]);
    expect(row?.searchVolume).toBe(90);
    // A zero CPC would read as "free to advertise on" — a false claim.
    expect(row?.cpc).toBeNull();
    expect(row?.competition).toBeNull();
  });

  it("drops related keywords missing a word of the seed", () => {
    // The real payload for "technical co-founder": Bing matches on "technical"
    // alone, and the colleges carry enough volume to sort above every genuine
    // match, so an unfiltered page showed nothing but colleges.
    const kept = relatedRowsMatchingSeed(
      [
        { Query: "chattahoochee technical college", Impressions: 6432 },
        { Query: "trident technical college", Impressions: 5277 },
        { Query: "technical cofounder", Impressions: 90 },
        // Written differently from the seed; still the same phrase.
        { Query: "find a technical co founder", Impressions: 40 },
      ],
      "technical co-founder",
    );
    expect(kept.map((row) => row.Query)).toEqual([
      "technical cofounder",
      "find a technical co founder",
    ]);
  });
});
