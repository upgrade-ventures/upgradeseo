import { describe, expect, it } from "vitest";

import {
  createMicrosoftAdsClient,
  parseMicrosoftAdsCredentials,
  toKeyword,
} from "@/server/lib/free-seo/microsoft-ads";

const credentials = {
  developerToken: "DEVTOKEN",
  accessToken: "access-token",
  customerId: "111",
  customerAccountId: "222",
};

/**
 * Records the search parameters the client actually put on the wire. Capturing
 * inside a typed fetch stub keeps the assertion free of casts, which
 * `vi.fn().mock.calls` would otherwise force.
 */
function clientWithSpy() {
  const sent: unknown[][] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = init?.body;
    if (typeof body === "string") {
      const parsed: unknown = JSON.parse(body);
      const params: unknown =
        parsed && typeof parsed === "object"
          ? Reflect.get(parsed, "SearchParameters")
          : null;
      sent.push(Array.isArray(params) ? params : []);
    }
    return new Response(JSON.stringify({ KeywordIdeas: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    searchParameters: () => sent[0] ?? [],
    client: createMicrosoftAdsClient({ credentials, fetchImpl }),
  };
}

function typeOf(param: unknown): unknown {
  return param && typeof param === "object" ? Reflect.get(param, "Type") : null;
}

describe("Microsoft Ads keyword ideas request", () => {
  it("tags every search parameter with its concrete Type", async () => {
    // `SearchParameter` is an abstract base in the REST interface; without the
    // `Type` discriminator the service cannot deserialize the request and
    // answers 400, so the client never completed a live call.
    const { client, searchParameters } = clientWithSpy();
    await client.keywordIdeas({ keywords: ["pricing"], limit: 10 });

    expect(searchParameters().map(typeOf)).toEqual([
      "QuerySearchParameter",
      "LanguageSearchParameter",
      "LocationSearchParameter",
      "NetworkSearchParameter",
    ]);
  });

  it("uses the url seed parameter when given a url", async () => {
    const { client, searchParameters } = clientWithSpy();
    await client.keywordIdeas({ url: "https://example.com", limit: 10 });

    expect(searchParameters()[0]).toEqual({
      Type: "UrlSearchParameter",
      Url: "https://example.com",
    });
  });
});

describe("toKeyword", () => {
  it("reads the newest month as current volume", () => {
    // Microsoft documents MonthlySearchCounts as newest-first, so index 0 is
    // the current month rather than the oldest.
    const row = toKeyword({
      Keyword: "pricing",
      MonthlySearchCounts: ["900", "800", "700"],
      SuggestedBid: 1.25,
      Competition: "Medium",
    });
    expect(row.searchVolume).toBe(900);
    expect(row.monthlySearchCounts).toEqual([900, 800, 700]);
    expect(row.suggestedBid).toBe(1.25);
    expect(row.competition).toBe(0.5);
  });

  it("leaves unsourceable fields null rather than zero", () => {
    const row = toKeyword({ Keyword: "unknown" });
    expect(row.searchVolume).toBeNull();
    expect(row.suggestedBid).toBeNull();
    expect(row.competition).toBeNull();
    expect(row.monthlySearchCounts).toEqual([]);
  });

  it("ignores a competition value outside the documented enum", () => {
    expect(
      toKeyword({ Keyword: "k", Competition: "Unknown" }).competition,
    ).toBeNull();
  });
});

describe("parseMicrosoftAdsCredentials", () => {
  const secret = JSON.stringify({
    developerToken: "DEVTOKEN",
    accessToken: "access-token",
  });

  it("splits the customer and account ids on the pipe", () => {
    expect(parseMicrosoftAdsCredentials(secret, "1234567|9876543")).toEqual({
      developerToken: "DEVTOKEN",
      accessToken: "access-token",
      customerId: "1234567",
      customerAccountId: "9876543",
    });
  });

  it("rejects a single id, so a half-entered key never looks configured", () => {
    expect(parseMicrosoftAdsCredentials(secret, "1234567")).toBeNull();
  });

  it("returns null on a missing token or unparseable secret", () => {
    expect(
      parseMicrosoftAdsCredentials(
        JSON.stringify({ developerToken: "D" }),
        "1|2",
      ),
    ).toBeNull();
    expect(parseMicrosoftAdsCredentials("not json", "1|2")).toBeNull();
  });
});
