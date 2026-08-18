import { describe, expect, it } from "vitest";

import {
  monthNumber,
  parseGoogleAdsCredentials,
} from "@/server/lib/free-seo/google-ads";

describe("Google Ads credentials", () => {
  const complete = JSON.stringify({
    developerToken: "DEVTOKEN22CHARSAAAA",
    clientId: "client.apps.googleusercontent.com",
    clientSecret: "GOCSPX-secret",
    refreshToken: "1//refresh-token-value",
  });

  it("strips dashes from a pasted manager customer id", () => {
    // Users paste manager ids in the dashed form Google displays.
    expect(
      parseGoogleAdsCredentials(complete, "123-456-7890")?.customerId,
    ).toBe("1234567890");
  });

  it("rejects a partially filled credential set", () => {
    const missingRefresh = JSON.stringify({
      developerToken: "t",
      clientId: "c",
      clientSecret: "s",
    });
    expect(parseGoogleAdsCredentials(missingRefresh, "123")).toBeNull();
    // A missing customer id is equally fatal: the URL path needs it.
    expect(parseGoogleAdsCredentials(complete, null)).toBeNull();
    expect(parseGoogleAdsCredentials(complete, "abc")).toBeNull();
  });

  it("returns null for input that is not JSON rather than throwing", () => {
    expect(parseGoogleAdsCredentials("a-bare-token", "123")).toBeNull();
  });
});

describe("month enum", () => {
  it("maps Google's month names to numbers", () => {
    // Google sends "JANUARY", not 1; treating it as a number silently zeroed
    // every seasonality point.
    expect(monthNumber("JANUARY")).toBe(1);
    expect(monthNumber("DECEMBER")).toBe(12);
    expect(monthNumber(undefined)).toBe(0);
    expect(monthNumber("NOT_A_MONTH")).toBe(0);
  });
});
