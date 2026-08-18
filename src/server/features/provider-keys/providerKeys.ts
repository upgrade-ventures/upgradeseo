/**
 * Per-organization provider credentials: storage, masking, and resolution.
 *
 * A tenant brings their own keys so they can run UpgradeSEO for their own brand
 * without the operator putting anything in `.env`. Resolution order is:
 *
 *   1. the organization's own stored key
 *   2. the instance environment variable
 *
 * That order matters. The env var stays a working default for single-tenant
 * self-hosts (nothing about the existing setup breaks), while a tenant who
 * saves their own key immediately stops sharing the operator's quota and bill.
 *
 * Plaintext leaves this module in exactly one direction: `resolveProviderKey`,
 * which is server-only and feeds an outbound API call. Nothing here returns a
 * decrypted secret to a caller that could serialise it to the browser.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { organizationProviderKeys } from "@/db/schema";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "@/server/lib/crypto/secret-box";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

/**
 * The providers a tenant may configure. Deliberately excludes any paid vendor and
 * OpenRouter: both are paid, and this install is free-only by owner mandate.
 * Adding one later is a change here, not a migration.
 */
/** Iteration order for the settings UI. Typed, so nothing needs an assertion. */
export const PROVIDER_IDS = [
  "microsoft_ads",
  "brightdata",
  "google_ads",
  "foundery",
  "bing",
  "openpagerank",
  "google_oauth",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDERS = {
  /**
   * Google Ads needs five values. Four are secret and travel together as a
   * JSON blob inside the encrypted column; the manager customer id is the
   * non-secret companion. This is why `secret` here is JSON, not a bare token.
   */
  /**
   * Microsoft Advertising. FIRST because its developer token is self-service,
   * so it is the only volume+CPC source that works on any account today.
   */
  microsoft_ads: {
    label: "Microsoft Advertising (volume and CPC, no approval)",
    envVar: "MICROSOFT_ADS_CREDENTIALS",
    publicField: {
      label: "Customer ID | Account ID",
      envVar: "MICROSOFT_ADS_ACCOUNT",
    },
    secretFields: [
      { name: "developerToken", label: "Developer token" },
      { name: "accessToken", label: "OAuth access token" },
    ],
  },
  /**
   * Bright Data SERP. OFF BY DEFAULT and opt-in per organization: it scrapes
   * Google rather than reading a licensed API, and the vendor contract puts
   * that exposure on us. See lib/free-seo/brightdata.ts for the full statement.
   */
  brightdata: {
    label: "Bright Data SERP (scraped, not licensed)",
    envVar: "BRIGHTDATA_API_TOKEN",
    publicField: {
      label: "Zone name",
      envVar: "BRIGHTDATA_ZONE",
    },
  },
  google_ads: {
    label: "Google Ads (real Google volume and CPC)",
    envVar: "GOOGLE_ADS_CREDENTIALS",
    publicField: {
      label: "Manager customer ID",
      envVar: "GOOGLE_ADS_CUSTOMER_ID",
    },
    /**
     * Four secret values, stored together as JSON inside the single encrypted
     * column. The UI renders one input per entry and serialises them.
     */
    secretFields: [
      { name: "developerToken", label: "Developer token" },
      { name: "clientId", label: "OAuth client ID" },
      { name: "clientSecret", label: "OAuth client secret" },
      { name: "refreshToken", label: "Refresh token" },
    ],
  },
  /** Azure AI Foundry. The ONLY sanctioned AI provider under the owner rule. */
  foundery: {
    label: "Foundery (Azure AI)",
    envVar: "FOUNDERY_API_KEY",
    publicField: {
      label: "Endpoint and deployment",
      envVar: "FOUNDERY_ENDPOINT",
    },
  },
  bing: {
    label: "Bing Webmaster Tools",
    envVar: "BING_WEBMASTER_API_KEY",
    /** Whether the provider also needs a non-secret companion value. */
    publicField: null,
  },
  openpagerank: {
    label: "OpenPageRank",
    envVar: "OPENPAGERANK_API_KEY",
    publicField: null,
  },
  google_oauth: {
    label: "Google Search Console",
    envVar: "GOOGLE_CLIENT_SECRET",
    publicField: {
      label: "Client ID",
      envVar: "GOOGLE_CLIENT_ID",
    },
  },
} as const;

export function isProviderId(value: string): value is ProviderId {
  return Object.hasOwn(PROVIDERS, value);
}

/** What the browser is allowed to know. Never includes secret material. */
export interface ProviderKeyStatus {
  provider: ProviderId;
  label: string;
  /** True when this organization stored its own key. */
  configuredByOrganization: boolean;
  /** True when the instance env supplies one as a fallback. */
  configuredByEnvironment: boolean;
  /** Last 4 characters of the org's secret, or "" for short secrets. */
  secretLastFour: string;
  /** Non-secret companion, e.g. a Google OAuth client ID. */
  publicIdentifier: string | null;
  /** Label for the public field, or null when the provider has none. */
  publicFieldLabel: string | null;
  /**
   * One entry per secret input. Multi-entry providers are serialised to JSON
   * by the client. Empty means a single unnamed secret.
   */
  secretFields: Array<{ name: string; label: string }>;
  updatedAt: string | null;
  /**
   * False when the server has no key material to encrypt with, which makes
   * saving impossible. Surfaced so the UI can explain the one-line fix rather
   * than letting every save fail with a generic error.
   */
  encryptionAvailable: boolean;
}

async function encryptionSecret(): Promise<string> {
  return (
    (await getOptionalEnvValue("SECRETS_ENCRYPTION_KEY")) ??
    (await getOptionalEnvValue("BETTER_AUTH_SECRET")) ??
    ""
  );
}

/**
 * Status of every provider for one organization. Safe to serialise to the
 * client: it reports whether a key exists, never what it is.
 */
export async function listProviderKeyStatus(
  organizationId: string,
): Promise<ProviderKeyStatus[]> {
  const rows = await db
    .select()
    .from(organizationProviderKeys)
    .where(eq(organizationProviderKeys.organizationId, organizationId));

  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  const encryptionAvailable = Boolean((await encryptionSecret()).trim());

  const statuses: ProviderKeyStatus[] = [];
  // Iterate the typed id list rather than Object.keys, which widens to string.
  for (const id of PROVIDER_IDS) {
    const config = PROVIDERS[id];
    const row = byProvider.get(id);
    statuses.push({
      provider: id,
      label: config.label,
      configuredByOrganization: Boolean(row),
      configuredByEnvironment: Boolean(
        await getOptionalEnvValue(config.envVar),
      ),
      secretLastFour: row?.secretLastFour ?? "",
      publicIdentifier: row?.publicIdentifier ?? null,
      publicFieldLabel: config.publicField?.label ?? null,
      secretFields: "secretFields" in config ? [...config.secretFields] : [],
      updatedAt: row?.updatedAt ?? null,
      encryptionAvailable,
    });
  }
  return statuses;
}

export async function saveProviderKey(input: {
  organizationId: string;
  provider: ProviderId;
  secret: string;
  publicIdentifier?: string | null;
  userId: string;
}): Promise<void> {
  const secret = input.secret.trim();
  if (!secret) throw new Error("The key cannot be empty");

  const sealed = await encryptSecret(
    secret,
    { organizationId: input.organizationId, provider: input.provider },
    await encryptionSecret(),
  );

  const now = new Date().toISOString();
  const values = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    provider: input.provider,
    secretCiphertext: sealed,
    publicIdentifier: input.publicIdentifier?.trim() || null,
    // A multi-field provider stores JSON, whose last 4 characters are
    // punctuation ('ue"}'), not a recognisable key fragment. Show nothing
    // rather than something meaningless.
    secretLastFour: secret.startsWith("{") ? "" : maskSecret(secret),
    createdByUserId: input.userId,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .insert(organizationProviderKeys)
    .values(values)
    .onConflictDoUpdate({
      target: [
        organizationProviderKeys.organizationId,
        organizationProviderKeys.provider,
      ],
      set: {
        secretCiphertext: values.secretCiphertext,
        publicIdentifier: values.publicIdentifier,
        secretLastFour: values.secretLastFour,
        updatedAt: now,
      },
    });
}

export async function deleteProviderKey(
  organizationId: string,
  provider: ProviderId,
): Promise<void> {
  await db
    .delete(organizationProviderKeys)
    .where(
      and(
        eq(organizationProviderKeys.organizationId, organizationId),
        eq(organizationProviderKeys.provider, provider),
      ),
    );
}

/**
 * The one function that returns plaintext. SERVER ONLY — the result must go
 * straight into an outbound request and never into a response body, a log
 * line, or an error message.
 *
 * A stored key that fails to decrypt (tampered, or written under a rotated
 * BETTER_AUTH_SECRET) falls through to the environment rather than throwing,
 * so a broken row degrades the tenant to the instance default instead of
 * taking their whole account down.
 */
export async function resolveProviderKey(
  organizationId: string | null,
  provider: ProviderId,
): Promise<{ secret: string; publicIdentifier: string | null } | null> {
  const config = PROVIDERS[provider];

  if (organizationId) {
    const [row] = await db
      .select()
      .from(organizationProviderKeys)
      .where(
        and(
          eq(organizationProviderKeys.organizationId, organizationId),
          eq(organizationProviderKeys.provider, provider),
        ),
      )
      .limit(1);

    if (row) {
      const secret = await decryptSecret(
        row.secretCiphertext,
        { organizationId, provider },
        await encryptionSecret(),
      );
      if (secret) {
        return { secret, publicIdentifier: row.publicIdentifier };
      }
      console.error(
        `provider key for organization ${organizationId} / ${provider} failed to decrypt; falling back to environment`,
      );
    }
  }

  const envSecret = await getOptionalEnvValue(config.envVar);
  if (!envSecret) return null;

  const envPublic = config.publicField
    ? ((await getOptionalEnvValue(config.publicField.envVar)) ?? null)
    : null;
  return { secret: envSecret, publicIdentifier: envPublic };
}
