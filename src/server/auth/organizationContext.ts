import type { EnsuredUserContext } from "@/middleware/ensure-user/types";

/**
 * Who is asking, and on behalf of which organization.
 *
 * This replaces OrganizationContext, which carried the same three fields
 * but existed to identify a paying customer to Autumn. Nothing is charged any
 * more, so the fields that mattered for metering are gone and what remains is
 * plain request identity: services need the organization to scope data, the
 * user id to attribute events, and the email for the provider integrations
 * that address a person rather than a tenant.
 */
export type OrganizationContext = Pick<
  EnsuredUserContext,
  "organizationId" | "userEmail" | "userId"
> & {
  projectId?: string;
};
