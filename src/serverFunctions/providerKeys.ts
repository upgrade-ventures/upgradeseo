import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  deleteProviderKey,
  isProviderId,
  listProviderKeyStatus,
  saveProviderKey,
} from "@/server/features/provider-keys/providerKeys";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

/**
 * Bring-your-own provider keys, scoped to the caller's organization.
 *
 * SECURITY NOTES, because this endpoint handles secrets:
 *
 * - `organizationId` is taken from the authenticated context, NEVER from the
 *   request body. A client cannot name another tenant's organization and read
 *   or overwrite its credentials.
 * - No handler returns secret material. `getProviderKeys` reports only whether
 *   a key exists, its last 4 characters, and any non-secret companion value.
 *   There is deliberately no "reveal" endpoint: a stored key is write-only
 *   from the browser's point of view.
 * - Authorization is org membership, not role. No other org-scoped feature in
 *   this app gates on `member.role`, and `local_noauth` synthesizes a context
 *   with no member row, so a role check here would lock self-host users out of
 *   their own settings while adding an inconsistency.
 */

const providerSchema = z.string().refine(isProviderId, {
  message: "Unknown provider",
});

const saveSchema = z.object({
  provider: providerSchema,
  // Length bounded so a hostile client cannot push a multi-megabyte "secret"
  // through encryption and into the row.
  secret: z.string().trim().min(1).max(512),
  publicIdentifier: z.string().trim().max(512).optional(),
});

const deleteSchema = z.object({ provider: providerSchema });

export const getProviderKeys = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) =>
    listProviderKeyStatus(context.organizationId),
  );

export const setProviderKey = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(saveSchema)
  .handler(async ({ context, data }) => {
    await saveProviderKey({
      organizationId: context.organizationId,
      provider: data.provider,
      secret: data.secret,
      publicIdentifier: data.publicIdentifier ?? null,
      userId: context.userId,
    });
    // Return the refreshed status, never the value that was just stored.
    return listProviderKeyStatus(context.organizationId);
  });

export const removeProviderKey = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(deleteSchema)
  .handler(async ({ context, data }) => {
    await deleteProviderKey(context.organizationId, data.provider);
    return listProviderKeyStatus(context.organizationId);
  });
