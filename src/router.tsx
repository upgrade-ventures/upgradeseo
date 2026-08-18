import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { DefaultCatchBoundary } from "./client/components/DefaultCatchBoundary";
import { NotFound } from "./client/components/NotFound";
import { BASE_PATH } from "./shared/base-path";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    // Empty at root, which is every deploy that owns its hostname. See
    // shared/base-path.ts for what else has to agree with this value.
    basepath: BASE_PATH || undefined,
    defaultPreload: "intent",
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  });

  return router;
}
