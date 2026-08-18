/**
 * Authenticated encryption for third-party provider keys stored in our
 * database (Bing Webmaster, OpenPageRank, and Google OAuth client secrets).
 *
 * Threat model, stated so the guarantees are not overread:
 *
 *   PROTECTS AGAINST — a leaked database. A dump of `organization_provider_keys`
 *   is useless without the server's key material, so an SQL injection, a stolen
 *   D1 export, a misplaced backup, or a support engineer reading rows cannot
 *   recover a tenant's credentials.
 *
 *   DOES NOT PROTECT AGAINST — an attacker with the running server's env. If
 *   they hold BETTER_AUTH_SECRET (or SECRETS_ENCRYPTION_KEY) they can decrypt.
 *   Nothing storage-side can fix that; it is the reason plaintext-at-rest is
 *   still worth eliminating but is not the whole story.
 *
 * AES-256-GCM, random 96-bit IV per record, and the ciphertext is BOUND to the
 * row it belongs to via additional authenticated data (AAD) of
 * `organizationId:provider`. That binding is the security property that matters
 * most here: an attacker with write access to the table cannot move another
 * tenant's ciphertext into their own row to have the server decrypt and use it
 * on their behalf. Decryption fails closed instead.
 *
 * Key material: a dedicated SECRETS_ENCRYPTION_KEY if the operator sets one,
 * otherwise derived from BETTER_AUTH_SECRET by HKDF-SHA256 under a distinct
 * `info` label. Deriving rather than reusing the secret directly keeps the
 * encryption key cryptographically separate from session signing, and means a
 * self-host install gets encryption with no extra configuration. Rotating
 * BETTER_AUTH_SECRET therefore invalidates stored provider keys; that is
 * documented for operators rather than silently worked around.
 */

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;
const KEY_BITS = 256;

/** Bumped only if the scheme changes; lets old rows be read during migration. */
const FORMAT_VERSION = "v1";

const HKDF_INFO = "upgradeseo:provider-keys:v1";

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

/**
 * A CryptoKey is derived per process and cached: HKDF on every request would
 * be wasteful, and the inputs never change within a deployment.
 */
const keyCache = new Map<string, Promise<CryptoKey>>();

async function deriveKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const promise = (async () => {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      "HKDF",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        // No salt: the input is already a high-entropy server secret, and a
        // stored random salt would have to live beside the ciphertext without
        // adding anything against this threat model.
        salt: new Uint8Array(0),
        info: new TextEncoder().encode(HKDF_INFO),
      },
      material,
      { name: ALGORITHM, length: KEY_BITS },
      false,
      ["encrypt", "decrypt"],
    );
  })();

  keyCache.set(secret, promise);
  return promise;
}

/**
 * Binds a ciphertext to the row that owns it. Passing a different org or
 * provider at decrypt time makes GCM authentication fail.
 */
function aad(
  organizationId: string,
  provider: string,
): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(`${organizationId}:${provider}`);
  // Copied into a plain ArrayBuffer: WebCrypto's BufferSource excludes the
  // SharedArrayBuffer-backed view type TextEncoder is declared to return.
  const buffer = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  buffer.set(bytes);
  return buffer;
}

interface SecretContext {
  organizationId: string;
  provider: string;
}

export async function encryptSecret(
  plaintext: string,
  context: SecretContext,
  secret: string,
): Promise<string> {
  if (!plaintext) throw new SecretBoxError("Cannot encrypt an empty secret");
  const key = await deriveKey(requireSecret(secret));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      additionalData: aad(context.organizationId, context.provider),
    },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `${FORMAT_VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

/**
 * Returns null rather than throwing on anything that fails to authenticate:
 * a tampered row, a row copied from another tenant, or a row written under a
 * rotated secret. Callers treat null as "no usable key", which degrades to the
 * env fallback instead of taking the whole request down.
 */
export async function decryptSecret(
  stored: string,
  context: SecretContext,
  secret: string,
): Promise<string | null> {
  const parts = stored.split(".");
  if (parts.length !== 3 || parts[0] !== FORMAT_VERSION) return null;

  try {
    const key = await deriveKey(requireSecret(secret));
    const plaintext = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: fromBase64(parts[1]),
        additionalData: aad(context.organizationId, context.provider),
      },
      key,
      fromBase64(parts[2]),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // Never surface why: distinguishing "wrong key" from "tampered" from
    // "wrong tenant" is an oracle. The caller only needs "unusable".
    return null;
  }
}

/**
 * The only part of a secret we are willing to show a user again. Short secrets
 * reveal nothing at all rather than most of themselves.
 */
export function maskSecret(plaintext: string): string {
  const trimmed = plaintext.trim();
  return trimmed.length < 8 ? "" : trimmed.slice(-4);
}

function requireSecret(secret: string): string {
  if (!secret || secret.trim().length === 0) {
    throw new SecretBoxError(
      "No key material available to encrypt provider secrets. Set BETTER_AUTH_SECRET (or SECRETS_ENCRYPTION_KEY).",
    );
  }
  return secret;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
