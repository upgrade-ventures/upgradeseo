import { z } from "zod";
import { waitUntil } from "cloudflare:workers";
import { RankTrackingService } from "@/server/features/rank-tracking/services/RankTrackingService";
import { captureServerEvent } from "@/server/lib/posthog";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";

const inputSchema = {
  projectId: projectIdSchema,
  trackerId: z
    .string()
    .uuid()
    .describe("Rank tracker ID from get_rank_tracker."),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

export const runRankTrackerTool = {
  name: "run_rank_tracker",
  config: {
    title: "Run rank tracker",
    description:
      "Start a live rank check for every keyword and configured device. Free: positions come from Search Console for domains you have verified, Bing Webmaster for verified sites, or an opt-in Bright Data zone. If a run is already in progress, its blocking run ID is reported instead of starting another. The schedule is unchanged.",
    inputSchema,
    outputSchema: z
      .object({
        trackerId: z.string(),
        started: z.boolean(),
        runId: z.string().optional(),
        blockingRunId: z.string().nullable().optional(),
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: Args, context) => {
    const result = await RankTrackingService.triggerCheck({
      configId: args.trackerId,
      projectId: args.projectId,
      billingCustomer: context.billing,
    });
    const trackerPath = `/p/${args.projectId}/rank-tracking/${args.trackerId}`;

    if (!result.ok) {
      return mcpResponse({
        text: `A rank check is already running for tracker ${args.trackerId}${result.blockingRunId ? ` (run ${result.blockingRunId})` : ""}. No new run was created and no additional check was charged. Poll get_rank_tracker until lastCheckedAt advances.`,
        meta: buildProjectMeta(context, args.projectId, trackerPath),
        structuredContent: {
          trackerId: args.trackerId,
          started: false,
          blockingRunId: result.blockingRunId,
        },
      });
    }

    waitUntil(
      captureServerEvent({
        distinctId: context.auth.userId,
        event: "rank_tracking:check_trigger",
        organizationId: context.auth.organizationId,
        properties: {
          project_id: args.projectId,
          config_id: args.trackerId,
          run_id: result.runId,
          source: "mcp",
        },
      }),
    );

    return mcpResponse({
      text: `Rank check ${result.runId} started for tracker ${args.trackerId}. Poll get_rank_tracker until lastCheckedAt advances, then read the updated positions.`,
      meta: buildProjectMeta(context, args.projectId, trackerPath),
      structuredContent: {
        trackerId: args.trackerId,
        started: true,
        runId: result.runId,
      },
    });
  }),
};
