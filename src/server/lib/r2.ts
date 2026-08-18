import { env } from "cloudflare:workers";

/**
 * R2 is optional on the free deploy (`alchemy.run.ts` drops the bucket because
 * enabling R2 requires a payment method). Unlike the cache, audit payloads are
 * real data, so this fails loudly and names the cause rather than throwing
 * "Cannot read properties of undefined".
 */
function requireBucket(): R2Bucket {
  const store = (env as { R2?: R2Bucket }).R2;
  if (!store) {
    throw new Error(
      "Object storage (R2) is not configured on this deployment, so large payloads cannot be stored. Site audits still run; Lighthouse payload storage is unavailable.",
    );
  }
  return store;
}

export async function getJsonFromR2(key: string): Promise<string> {
  const object = await requireBucket().get(key);
  if (!object) {
    throw new Error("Audit payload not found");
  }

  return object.text();
}

export async function putTextToR2(
  key: string,
  body: string,
): Promise<{ key: string; sizeBytes: number }> {
  await requireBucket().put(key, body, {
    httpMetadata: {
      contentType: "application/json",
    },
  });

  return {
    key,
    sizeBytes: Buffer.byteLength(body),
  };
}
