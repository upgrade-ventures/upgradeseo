import { describe, expect, it } from "vitest";

import { normalizeBasePath, stripApiBasePath } from "@/shared/base-path";

/**
 * The basepath contract, pinned. Every failure mode here shipped once this
 * week: doubled prefixes blanked the asset URLs, an unstripped /api path made
 * the router 404 with an empty body, and a stripped /api/auth path broke
 * Better Auth, whose own basePath matches the PREFIXED form.
 */
describe("normalizeBasePath", () => {
  it("treats empty, slash-only and undefined as a root mount", () => {
    expect(normalizeBasePath(undefined)).toBe("");
    expect(normalizeBasePath("")).toBe("");
    expect(normalizeBasePath("/")).toBe("");
    expect(normalizeBasePath("  ")).toBe("");
  });

  it("normalizes hand-typed variants to one leading-slash form", () => {
    expect(normalizeBasePath("UpgradeSEO")).toBe("/UpgradeSEO");
    expect(normalizeBasePath("/UpgradeSEO")).toBe("/UpgradeSEO");
    expect(normalizeBasePath("/UpgradeSEO/")).toBe("/UpgradeSEO");
    expect(normalizeBasePath(" /UpgradeSEO ")).toBe("/UpgradeSEO");
  });
});

describe("stripApiBasePath", () => {
  it("is a no-op on a root mount", () => {
    expect(stripApiBasePath("/api/health", "")).toBe("/api/health");
  });

  it("strips the prefix from api routes so Start's file routes match", () => {
    expect(stripApiBasePath("/UpgradeSEO/api/health", "/UpgradeSEO")).toBe(
      "/api/health",
    );
  });

  it("leaves auth routes prefixed, where Better Auth matches them", () => {
    expect(
      stripApiBasePath("/UpgradeSEO/api/auth/get-session", "/UpgradeSEO"),
    ).toBe("/UpgradeSEO/api/auth/get-session");
  });

  it("leaves page routes and foreign paths untouched", () => {
    expect(stripApiBasePath("/UpgradeSEO/sign-in", "/UpgradeSEO")).toBe(
      "/UpgradeSEO/sign-in",
    );
    expect(stripApiBasePath("/api/health", "/UpgradeSEO")).toBe("/api/health");
  });
});
