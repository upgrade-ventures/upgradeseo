import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The onboarding strategy chat is gone.
 *
 * The delivered design has no chat surface anywhere in the product, so the
 * agent conversation this route used to render has been removed. The route
 * itself stays so that a bookmark, a browser-history entry or a link sent to a
 * colleague lands on the checklist instead of a dead 404.
 */
export const Route = createFileRoute("/_authenticated/onboarding/chat")({
  beforeLoad: () => {
    throw redirect({ to: "/onboarding", search: { step: 0 }, replace: true });
  },
});
