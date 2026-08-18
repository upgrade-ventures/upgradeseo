import { z } from "zod";
import { BacklinksService } from "@/server/features/backlinks/services/BacklinksService";
import { mcpResponse } from "@/server/mcp/formatters";
import { buildProjectMeta } from "@/server/mcp/context";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import {
  formatMcpTable,
  readPath,
  type McpTableColumn,
} from "@/server/mcp/table";
import { projectIdSchema } from "@/server/mcp/schemas";

const REFERRING_DOMAIN_COLUMNS: McpTableColumn<unknown>[] = [
  { header: "domain", value: (row) => readPath(row, "domain") },
  { header: "backlinks", value: (row) => readPath(row, "backlinks") },
  {
    header: "referring pages",
    value: (row) => readPath(row, "referringPages"),
  },
  { header: "rank", value: (row) => readPath(row, "rank") },
];

const inputSchema = {
  projectId: projectIdSchema,
  target: z
    .string()
    .min(1)
    .describe(
      "Domain or URL to analyze (e.g. 'example.com' or 'https://example.com/blog').",
    ),
  scope: z
    .enum(["domain", "page"])
    .optional()
    .describe(
      "'domain' analyzes the whole domain; 'page' analyzes a specific URL. Defaults to 'domain'.",
    ),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

function formatMetric(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : "?";
}

export const getBacklinksOverviewTool = {
  name: "get_backlinks_overview",
  config: {
    title: "Get backlinks overview",
    description:
      "Returns a backlinks profile summary (referring domain count, authority, and the referring domains themselves). Authority and referring-domain counts come from OpenPageRank and cover any domain; the individual links come from Bing Webmaster Tools, which reports them only for a site verified in your own Bing account. Referring-page counts and spam scores are unavailable from every free source and are returned as unknown, never zero. Connect a free OpenPageRank key, and verify the site in Bing Webmaster Tools for link-level rows.",
    inputSchema,
    outputSchema: {
      overview: looseObjectOutputSchema,
      referringDomains: looseObjectOutputSchema,
      ...optionalMetaOutputSchema,
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: Args, context) => {
    const lookup = { target: args.target, scope: args.scope };
    const [overview, refDomains] = await Promise.all([
      BacklinksService.profileOverview(lookup, context.billing),
      BacklinksService.profileReferringDomainsPage(
        {
          ...lookup,
          page: 1,
          pageSize: 100,
          sortField: "backlinks",
          sortOrder: "desc",
          filters: {},
        },
        context.billing,
      ),
    ]);
    const topDomains = refDomains.rows ?? [];
    const summary = overview.overview.summary;
    const text = [
      `Backlinks profile for ${args.target} (${args.scope ?? "domain"}):`,
      `- backlinks: ${formatMetric(summary.backlinks)}`,
      `- referring domains: ${formatMetric(summary.referringDomains)}`,
      `- referring pages: ${formatMetric(summary.referringPages)}`,
      // Not a link-index rank: the free stack scales OpenPageRank's 0-10
      // authority onto 0-100, so the label has to say which of the two it is.
      `- domain authority (0-100 proxy): ${formatMetric(summary.rank)}`,
      '"?" means no free source publishes this number for this target, not zero.',
      "",
      topDomains.length === 0
        ? "No referring domains found."
        : `Referring domains (${topDomains.length}):\n${formatMcpTable(topDomains, REFERRING_DOMAIN_COLUMNS)}`,
    ].join("\n");
    return mcpResponse({
      text,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/backlinks`,
        { target: args.target },
      ),
      structuredContent: { overview, referringDomains: refDomains },
    });
  }),
};
