import { waitUntil } from "cloudflare:workers";
import { z } from "zod";
import { RankTrackingService } from "@/server/features/rank-tracking/services/RankTrackingService";
import { AppError } from "@/server/lib/errors";
import { captureServerEvent } from "@/server/lib/posthog";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import {
  languageCodeSchema,
  locationCodeSchema,
  projectIdSchema,
} from "@/server/mcp/schemas";
import { domainField } from "@/types/schemas/domain";

const inputSchema = {
  projectId: projectIdSchema,
  domain: domainField
    .optional()
    .describe(
      "Domain to track. Defaults to the project's domain. Accepts a hostname or URL and stores the normalized hostname.",
    ),
  locationCode: locationCodeSchema.optional(),
  languageCode: languageCodeSchema.optional(),
  locationName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe("Optional city or region name for local rank tracking."),
  devices: z
    .enum(["desktop", "mobile", "both"])
    .optional()
    .describe("Devices to track. Defaults to mobile."),
  serpDepth: z
    .number()
    .int()
    .min(10)
    .max(100)
    .multipleOf(10)
    .optional()
    .describe("Number of Google results to inspect. Defaults to 40."),
  scheduleInterval: z
    .enum(["manual", "daily", "weekly", "monthly"])
    .optional()
    .describe(
      "Check schedule. Defaults to manual, so creating a tracker starts nothing on its own.",
    ),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

export const createRankTrackerTool = {
  name: "create_rank_tracker",
  config: {
    title: "Create rank tracker",
    description:
      "Create a rank tracking configuration for a project. Creating an empty tracker starts no check; daily, weekly and monthly trackers begin running once keywords are added. The domain defaults to the project's domain; market defaults to the project's market; devices default to mobile, search depth to 40, and schedule to manual. Call get_rank_tracker first to avoid duplicates.",
    inputSchema,
    outputSchema: z
      .object({
        trackerId: z.string(),
        config: looseObjectOutputSchema,
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: Args, context) => {
    const domain = args.domain ?? context.project.domain;
    if (!domain) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Provide a domain or set the project's domain first",
      );
    }

    const config = await RankTrackingService.createConfig({
      projectId: args.projectId,
      projectMarket: context.project,
      domain,
      locationCode: args.locationCode,
      languageCode: args.languageCode,
      locationName: args.locationName,
      devices: args.devices ?? "mobile",
      serpDepth: args.serpDepth ?? 40,
      scheduleInterval: args.scheduleInterval ?? "manual",
    });
    waitUntil(
      captureServerEvent({
        distinctId: context.auth.userId,
        event: "rank_tracking:config_create",
        organizationId: context.auth.organizationId,
        properties: {
          project_id: args.projectId,
          domain: config.domain,
          devices: config.devices,
          schedule: config.scheduleInterval,
          source: "mcp",
        },
      }),
    );

    return mcpResponse({
      text: `Created rank tracker ${config.id} for ${config.domain} (${config.devices}, top ${config.serpDepth}, ${config.scheduleInterval}). No keywords were added and no check was started.${config.scheduleInterval === "manual" ? "" : " Scheduled checks begin once keywords are added."}`,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/rank-tracking/${config.id}`,
      ),
      structuredContent: {
        trackerId: config.id,
        config,
      },
    });
  }),
};
