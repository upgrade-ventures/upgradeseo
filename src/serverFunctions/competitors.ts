import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  addCompetitor,
  harvestCompetitor,
  listCompetitors,
  removeCompetitor,
} from "@/server/features/competitors/competitorService";
import { requireProjectContext } from "@/serverFunctions/middleware";

/**
 * Competitor targeting footprints, scoped to the caller's project.
 *
 * `projectId` comes from the authenticated context, never the request body, so
 * a client cannot read or mutate another project's competitors.
 */

// `projectId` must be in the PAYLOAD, not just the URL: ensureUserMiddleware
// reads it from the request data to resolve project context, and without it
// requireProjectContext throws. The authoritative id still comes back from
// `context`, so a client cannot address another project by lying here.
const projectSchema = z.object({ projectId: z.string().min(1).max(64) });
const domainSchema = projectSchema.extend({
  domain: z.string().trim().min(3).max(253),
});
const idSchema = projectSchema.extend({
  competitorId: z.string().min(1).max(64),
});

export const getCompetitors = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema)
  .handler(async ({ context }) => listCompetitors(context.projectId));

export const createCompetitor = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(domainSchema)
  .handler(async ({ context, data }) => {
    await addCompetitor({ projectId: context.projectId, domain: data.domain });
    return listCompetitors(context.projectId);
  });

export const deleteCompetitor = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(idSchema)
  .handler(async ({ context, data }) => {
    await removeCompetitor(context.projectId, data.competitorId);
    return listCompetitors(context.projectId);
  });

/**
 * Runs the Common Crawl harvest. Slow by nature (8-20s, and it can fail), so
 * the client calls this explicitly rather than on page load.
 */
export const refreshCompetitor = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(idSchema)
  .handler(async ({ context, data }) => {
    await harvestCompetitor({
      projectId: context.projectId,
      competitorId: data.competitorId,
    });
    return listCompetitors(context.projectId);
  });
