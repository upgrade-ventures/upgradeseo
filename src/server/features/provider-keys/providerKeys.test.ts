import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isProviderId,
  PROVIDERS,
} from "@/server/features/provider-keys/providerKeys";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ organizationProviderKeys: {} }));

describe("provider registry", () => {
  it("accepts only known providers", () => {
    expect(isProviderId("bing")).toBe(true);
    expect(isProviderId("openpagerank")).toBe(true);
    expect(isProviderId("google_oauth")).toBe(true);
    expect(isProviderId("paid_vendor")).toBe(false);
    // Guards against a client sending a prototype key to reach Object.prototype.
    expect(isProviderId("toString")).toBe(false);
    expect(isProviderId("__proto__")).toBe(false);
  });

  it("excludes the paid providers the owner ruled out", () => {
    // Adding either back is a deliberate decision, not an accident.
    expect(Object.keys(PROVIDERS)).not.toContain("paid_vendor");
    expect(Object.keys(PROVIDERS)).not.toContain("openrouter");
  });

  it("maps every provider to the env var it falls back to", () => {
    expect(PROVIDERS.bing.envVar).toBe("BING_WEBMASTER_API_KEY");
    expect(PROVIDERS.openpagerank.envVar).toBe("OPENPAGERANK_API_KEY");
    // Google needs a public companion value; the others do not.
    expect(PROVIDERS.google_oauth.publicField?.envVar).toBe("GOOGLE_CLIENT_ID");
    expect(PROVIDERS.bing.publicField).toBeNull();
  });
});

describe("resolveProviderKey precedence", () => {
  // Per-test `vi.doMock` + dynamic import, which the repo normally bans:
  // resolution is a function of two module-level singletons (`db` and the
  // runtime env reader), and each case below needs a DIFFERENT pair of them.
  // A single hoisted `vi.mock` cannot express "row present and env set" and
  // "no row, env set" in one file, and the precedence order between those two
  // sources is exactly the invariant worth testing.
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadWithRow(
    row: Record<string, unknown> | undefined,
    envValues: Record<string, string | undefined>,
  ) {
    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({ limit: async () => (row ? [row] : []) }),
          }),
        }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      organizationProviderKeys: {
        organizationId: "organization_id",
        provider: "provider",
      },
    }));
    vi.doMock("@/server/lib/runtime-env", () => ({
      getOptionalEnvValue: async (name: string) => envValues[name],
    }));
    return import("@/server/features/provider-keys/providerKeys");
  }

  it("prefers the organization key over the environment", async () => {
    const { encryptSecret } = await import("@/server/lib/crypto/secret-box");
    const sealed = await encryptSecret(
      "org-own-key",
      { organizationId: "org_1", provider: "bing" },
      "server-secret-value-long-enough",
    );
    const mod = await loadWithRow(
      { secretCiphertext: sealed, publicIdentifier: null },
      {
        BETTER_AUTH_SECRET: "server-secret-value-long-enough",
        BING_WEBMASTER_API_KEY: "instance-env-key",
      },
    );

    const resolved = await mod.resolveProviderKey("org_1", "bing");
    expect(resolved?.secret).toBe("org-own-key");
  });

  it("falls back to the environment when the org has no key", async () => {
    const mod = await loadWithRow(undefined, {
      BETTER_AUTH_SECRET: "server-secret-value-long-enough",
      BING_WEBMASTER_API_KEY: "instance-env-key",
    });
    const resolved = await mod.resolveProviderKey("org_1", "bing");
    expect(resolved?.secret).toBe("instance-env-key");
  });

  it("falls back to the environment when a stored row cannot be decrypted", async () => {
    // A row written under a since-rotated BETTER_AUTH_SECRET must degrade the
    // tenant to the instance default, not take their account down.
    const mod = await loadWithRow(
      { secretCiphertext: "v1.bogus.bogus", publicIdentifier: null },
      {
        BETTER_AUTH_SECRET: "server-secret-value-long-enough",
        BING_WEBMASTER_API_KEY: "instance-env-key",
      },
    );
    const resolved = await mod.resolveProviderKey("org_1", "bing");
    expect(resolved?.secret).toBe("instance-env-key");
  });

  it("returns null when neither source has a key", async () => {
    const mod = await loadWithRow(undefined, {
      BETTER_AUTH_SECRET: "server-secret-value-long-enough",
    });
    expect(await mod.resolveProviderKey("org_1", "bing")).toBeNull();
  });

  it("skips the org lookup entirely when there is no organization", async () => {
    const mod = await loadWithRow(undefined, {
      BETTER_AUTH_SECRET: "server-secret-value-long-enough",
      BING_WEBMASTER_API_KEY: "instance-env-key",
    });
    const resolved = await mod.resolveProviderKey(null, "bing");
    expect(resolved?.secret).toBe("instance-env-key");
  });
});
