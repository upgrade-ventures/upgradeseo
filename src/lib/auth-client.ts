import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "@better-auth/api-key/client";
import {
  genericOAuthClient,
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { captureClientEvent, resetAnalyticsUser } from "@/client/lib/posthog";
import { userAdditionalFields } from "@/lib/auth-options";
import { getSignInHrefForLocation } from "@/lib/auth-redirect";
import { withBasePath } from "@/shared/base-path";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  // Must match the server's basePath in lib/auth.ts. baseURL is the origin, so
  // without this the client calls upgrade.ventures/api/auth — the root of the
  // hostname, which Ghost serves — and every session lookup hangs. The visible
  // symptom is a blank auth page, because the layout renders null while the
  // session query is pending and that query never settles.
  basePath: withBasePath("/api/auth"),
  plugins: [
    apiKeyClient(),
    organizationClient(),
    genericOAuthClient(),
    inferAdditionalFields({ user: userAdditionalFields }),
  ],
});

export const { useSession } = authClient;

export function signOutAndRedirect() {
  const signInHref = getSignInHrefForLocation(window.location);
  captureClientEvent("auth:sign_out");
  resetAnalyticsUser();
  void authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.assign(signInHref);
      },
    },
  });
}
