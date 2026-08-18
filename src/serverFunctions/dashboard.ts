import { createServerFn } from "@tanstack/react-start";
import { DashboardService } from "@/server/features/dashboard/services/DashboardService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { dashboardProjectInputSchema } from "@/types/schemas/dashboard";

export const getDashboardActivation = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(dashboardProjectInputSchema)
  .handler(({ context }) =>
    DashboardService.getActivation({
      projectId: context.projectId,
      organizationId: context.organizationId,
      domain: context.project.domain,
    }),
  );

export const getDashboardOverview = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(dashboardProjectInputSchema)
  .handler(({ context }) =>
    DashboardService.getOverview({
      projectId: context.projectId,
      domain: context.project.domain,
    }),
  );

export const getDashboardActivity = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(dashboardProjectInputSchema)
  .handler(({ context }) =>
    DashboardService.getActivity({ projectId: context.projectId }),
  );

// Visit-triggered: the client calls this when the overview reports a missing
// or stale backlink snapshot. Refreshed at most once per
// project per day (the service re-checks freshness server-side).
export const refreshDashboardBacklinkSnapshot = createServerFn({
  method: "POST",
})
  .middleware(requireProjectContext)
  .validator(dashboardProjectInputSchema)
  .handler(({ context }) =>
    DashboardService.ensureBacklinkSnapshot({
      projectId: context.projectId,
      domain: context.project.domain,
      billingCustomer: context,
    }),
  );
