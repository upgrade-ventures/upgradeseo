import {
  type CallToolResult,
  McpServer,
  type ToolAnnotations,
} from "@modelcontextprotocol/server";
import type { z } from "zod";
import {
  createMcpToolContext,
  type McpProps,
  type ToolContext,
} from "@/server/mcp/context";
import { objectSchema } from "@/server/mcp/output-schemas";
import { instrumentMcpToolHandler } from "@/server/mcp/instrumentation";
import { getBacklinksOverviewTool } from "@/server/mcp/tools/get-backlinks-overview";
import { getBacklinksProfileTool } from "@/server/mcp/tools/get-backlinks-profile";
import { getDomainKeywordSuggestionsTool } from "@/server/mcp/tools/get-domain-keyword-suggestions";
import { getDomainOverviewTool } from "@/server/mcp/tools/get-domain-overview";
import { addRankTrackingKeywordsTool } from "@/server/mcp/tools/add-rank-tracking-keywords";
import { createRankTrackerTool } from "@/server/mcp/tools/create-rank-tracker";
import { getRankTrackerTool } from "@/server/mcp/tools/get-rank-tracker";
import { removeRankTrackingKeywordsTool } from "@/server/mcp/tools/remove-rank-tracking-keywords";
import { runRankTrackerTool } from "@/server/mcp/tools/run-rank-tracker";
import { getSerpResultsTool } from "@/server/mcp/tools/get-serp-results";
import {
  getGoogleAnalyticsAudienceBreakdownTool,
  getGoogleAnalyticsEcommercePerformanceTool,
  getGoogleAnalyticsKeyEventsTool,
  getGoogleAnalyticsMeasurementHealthTool,
  getGoogleAnalyticsOrganicLandingPagesTool,
  getGoogleAnalyticsOrganicOverviewTool,
  getGoogleAnalyticsPagePerformanceTool,
  getGoogleAnalyticsSiteSearchTool,
  getGoogleAnalyticsTrafficAcquisitionTool,
  getSearchOpportunitiesTool,
} from "@/server/mcp/tools/google-analytics-tools";
import { createProjectTool } from "@/server/mcp/tools/create-project";
import { listProjectsTool } from "@/server/mcp/tools/list-projects";
import { listSavedKeywordsTool } from "@/server/mcp/tools/list-saved-keywords";
import { getKeywordMetricsTool } from "@/server/mcp/tools/research-tools";
import { researchKeywordsTool } from "@/server/mcp/tools/research-keywords";
import { saveKeywordsTool } from "@/server/mcp/tools/save-keywords";
import {
  getSearchConsolePerformanceTool,
  inspectUrlsTool,
} from "@/server/mcp/tools/search-console-tools";
import {
  getAuditIssuesTool,
  getAuditPagesTool,
  getAuditStatusTool,
  runSiteAuditTool,
} from "@/server/mcp/tools/site-audit-tools";
import { whoamiTool } from "@/server/mcp/tools/whoami";

type ToolSchema = z.ZodType | z.ZodRawShape;

// Tools declare inputSchema as either a raw Zod shape (most tools) or a full
// z.object (the GA4 tools); both normalize to one object schema at
// registration.
type ToolArgs<Input extends ToolSchema> = Input extends z.ZodType
  ? z.infer<Input>
  : Input extends z.ZodRawShape
    ? z.infer<z.ZodObject<Input>>
    : never;

type UpgradeSeoToolDefinition<Input extends ToolSchema> = {
  name: string;
  config: {
    title?: string;
    description?: string;
    inputSchema: Input;
    outputSchema?: ToolSchema;
    annotations?: ToolAnnotations;
  };
  handler: (
    args: ToolArgs<Input>,
    context: ToolContext,
  ) => CallToolResult | Promise<CallToolResult>;
};

function registerUpgradeSeoTool<Input extends ToolSchema>(
  server: McpServer,
  tool: UpgradeSeoToolDefinition<Input>,
  authProps: McpProps,
) {
  const outputSchema = objectSchema(tool.config.outputSchema);
  const handler = instrumentMcpToolHandler(
    tool.name,
    outputSchema,
    tool.handler,
  );

  server.registerTool(
    tool.name,
    {
      ...tool.config,
      inputSchema: objectSchema(tool.config.inputSchema),
      outputSchema,
    },
    (args, context) => {
      return handler(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- args were validated against the tool's own inputSchema just above
        args as ToolArgs<Input>,
        createMcpToolContext(context, authProps),
      );
    },
  );
}

export function createUpgradeSeoMcpServer(authProps: McpProps) {
  const server = new McpServer(
    {
      name: "UpgradeSEO MCP",
      title: "UpgradeSEO",
      version: "0.0.11",
      description:
        "SEO research tools for AI agents: keyword research and metrics, domain and backlink analysis, rank tracking, site audits, and Google Search Console and Analytics performance.",
      websiteUrl: "",
      icons: [
        {
          src: "",
          mimeType: "image/png",
          sizes: ["512x512"],
        },
      ],
    },
    {
      instructions:
        "UpgradeSEO reads free data sources the user has connected (Google Search Console, Google Analytics, Google Ads, Bing Webmaster Tools, OpenPageRank). A tool that reports a value as unknown means no connected free source publishes it; treat that as missing data, never as zero, and tell the user which source to connect. Ranking and link data for a site the user has not verified is not available at all.",
    },
  );

  const register = <Input extends ToolSchema>(
    tool: UpgradeSeoToolDefinition<Input>,
  ) => registerUpgradeSeoTool(server, tool, authProps);

  register(whoamiTool);
  register(listProjectsTool);
  register(createProjectTool);
  register(listSavedKeywordsTool);
  register(researchKeywordsTool);
  register(saveKeywordsTool);
  register(getDomainOverviewTool);
  register(getDomainKeywordSuggestionsTool);
  register(getBacklinksOverviewTool);
  register(getBacklinksProfileTool);
  register(getSerpResultsTool);
  register(createRankTrackerTool);
  register(getRankTrackerTool);
  register(addRankTrackingKeywordsTool);
  register(removeRankTrackingKeywordsTool);
  register(runRankTrackerTool);
  register(getKeywordMetricsTool);
  register(getSearchConsolePerformanceTool);
  register(inspectUrlsTool);
  register(getGoogleAnalyticsOrganicLandingPagesTool);
  register(getGoogleAnalyticsPagePerformanceTool);
  register(getGoogleAnalyticsKeyEventsTool);
  register(getSearchOpportunitiesTool);
  register(getGoogleAnalyticsOrganicOverviewTool);
  register(getGoogleAnalyticsTrafficAcquisitionTool);
  register(getGoogleAnalyticsMeasurementHealthTool);
  register(getGoogleAnalyticsEcommercePerformanceTool);
  register(getGoogleAnalyticsSiteSearchTool);
  register(getGoogleAnalyticsAudienceBreakdownTool);
  register(runSiteAuditTool);
  register(getAuditStatusTool);
  register(getAuditIssuesTool);
  register(getAuditPagesTool);

  return server;
}
