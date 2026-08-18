import { describe, expect, it } from "vitest";

import {
  parseBrightDataCredentials,
  parseOrganic,
  positionOf,
} from "@/server/lib/free-seo/brightdata";

const payload = {
  organic: [
    { rank: 1, link: "https://www.masslight.com/build", title: "Build" },
    { rank: 2, link: "https://antler.co/apply", title: "Apply" },
    { link: "not a url" },
  ],
};

describe("Bright Data SERP parsing", () => {
  it("reads rank, url and domain, dropping unparseable rows", () => {
    const rows = parseOrganic(payload);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      position: 1,
      domain: "masslight.com",
      // Provenance is mandatory: a scraped position must never be mistaken
      // for a licensed measurement downstream.
      source: "brightdata",
    });
  });

  it("returns nothing for a payload whose shape changed", () => {
    // Scraped payloads change without notice; losing the SERP beats throwing.
    expect(parseOrganic({ results: [] })).toEqual([]);
    expect(parseOrganic("nope")).toEqual([]);
  });

  it("reports absence as null, never as 0 or 101", () => {
    const rows = parseOrganic(payload);
    expect(positionOf(rows, "antler.co")).toBe(2);
    expect(positionOf(rows, "www.masslight.com")).toBe(1);
    // "Not in the results we fetched" is not a rank.
    expect(positionOf(rows, "example.com")).toBeNull();
  });

  it("requires both a token and a zone", () => {
    expect(parseBrightDataCredentials("token", "serp")).toEqual({
      apiToken: "token",
      zone: "serp",
    });
    expect(parseBrightDataCredentials("token", null)).toBeNull();
    expect(parseBrightDataCredentials("  ", "serp")).toBeNull();
  });
});
