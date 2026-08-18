import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  maskSecret,
  SecretBoxError,
} from "@/server/lib/crypto/secret-box";

const SECRET = "a-long-enough-server-secret-for-tests-0123456789";
const CONTEXT = { organizationId: "org_1", provider: "bing" };

describe("secret box", () => {
  it("round-trips a secret", async () => {
    const sealed = await encryptSecret("bing-key-value", CONTEXT, SECRET);
    expect(sealed).not.toContain("bing-key-value");
    expect(await decryptSecret(sealed, CONTEXT, SECRET)).toBe("bing-key-value");
  });

  it("produces a different ciphertext every time", async () => {
    // A deterministic ciphertext would leak that two tenants use the same key.
    const a = await encryptSecret("same", CONTEXT, SECRET);
    const b = await encryptSecret("same", CONTEXT, SECRET);
    expect(a).not.toBe(b);
  });

  it("refuses a ciphertext moved to another organization", async () => {
    // The property that matters: an attacker who can write to the table must
    // not be able to paste another tenant's row into their own and have the
    // server decrypt and spend against it.
    const sealed = await encryptSecret("victim-key", CONTEXT, SECRET);
    const stolen = await decryptSecret(
      sealed,
      { organizationId: "org_attacker", provider: "bing" },
      SECRET,
    );
    expect(stolen).toBeNull();
  });

  it("refuses a ciphertext moved to another provider slot", async () => {
    const sealed = await encryptSecret("bing-key", CONTEXT, SECRET);
    expect(
      await decryptSecret(
        sealed,
        { organizationId: "org_1", provider: "openpagerank" },
        SECRET,
      ),
    ).toBeNull();
  });

  it("returns null for a tampered ciphertext rather than throwing", async () => {
    const sealed = await encryptSecret("value", CONTEXT, SECRET);
    const [version, iv, body] = sealed.split(".");
    const flipped = body.startsWith("A")
      ? `B${body.slice(1)}`
      : `A${body.slice(1)}`;
    expect(
      await decryptSecret(`${version}.${iv}.${flipped}`, CONTEXT, SECRET),
    ).toBeNull();
  });

  it("returns null under a rotated server secret, never a crash", async () => {
    const sealed = await encryptSecret("value", CONTEXT, SECRET);
    expect(
      await decryptSecret(sealed, CONTEXT, "a-different-secret"),
    ).toBeNull();
  });

  it("rejects an unknown format version instead of guessing", async () => {
    expect(await decryptSecret("v2.aaaa.bbbb", CONTEXT, SECRET)).toBeNull();
    expect(await decryptSecret("garbage", CONTEXT, SECRET)).toBeNull();
  });

  it("fails loudly when there is no key material", async () => {
    await expect(encryptSecret("value", CONTEXT, "")).rejects.toThrow(
      SecretBoxError,
    );
  });

  it("masks to the last 4 characters, and short secrets not at all", () => {
    expect(maskSecret("abcdefghijkl")).toBe("ijkl");
    // A 6-character secret would be mostly revealed by a 4-character hint.
    expect(maskSecret("abcdef")).toBe("");
  });
});
