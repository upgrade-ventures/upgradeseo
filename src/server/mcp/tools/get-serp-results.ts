import { z } from "zod";
import { KeywordResearchService } from "@/server/features/keywords/services/KeywordResearchService";
import { mcpResponse } from "@/server/mcp/formatters";
import { buildProjectMeta } from "@/server/mcp/context";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { resolveMarket } from "@/shared/keyword-locations";
import { formatMcpTable, type McpTableColumn } from "@/server/mcp/table";
import {
  languageCodeSchema,
  locationCodeSchema,
  projectIdSchema,
} from "@/server/mcp/schemas";

type PositionRow = {
  rank: number;
  title: string;
  url: string;
  domain: string;
  description: string;
};

const POSITION_COLUMNS: McpTableColumn<PositionRow>[] = [
  { header: "position", value: (item) => item.rank },
  { header: "domain", value: (item) => item.domain },
  { header: "url", value: (item) => item.url },
  { header: "detail", value: (item) => item.title },
];

const querySchema = z.object({
  keyword: z.string().min(1).describe("Search query to look up."),
  locationCode: locationCodeSchema.optional(),
  languageCode: languageCodeSchema.optional(),
});

const inputSchema = {
  projectId: projectIdSchema,
  queries: z
    .array(querySchema)
    .min(1)
    .max(10)
    .describe(
      "1-10 queries. Bulk-friendly — prefer this over multiple single-query calls.",
    ),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

export const getSerpResultsTool = {
  name: "get_serp_results",
  config: {
    title: "Get your search positions for a query",
    description:
      "Returns the pages of YOUR OWN verified site that Google ranks for 1-10 keywords, with the average position, impressions, and clicks Search Console reports over the last 28 days. This is NOT a live SERP and it does NOT list competitors: no free source returns the ten organic results for an arbitrary keyword, so the tool answers 'where do I rank for this' instead of inventing the wider ranking table. Requires Google Search Console connected to the project. Positions are a 28-day average, not a live check. Per-keyword errors don't fail the batch.",
    inputSchema,
    outputSchema: {
      results: z.array(
        z.union([
          z
            .object({
              keyword: z.string(),
              ok: z.literal(true),
              source: z.string().nullable(),
              notice: z.string().nullable(),
              items: z.array(
                z
                  .object({
                    rank: z.number(),
                    title: z.string(),
                    url: z.string(),
                    domain: z.string(),
                    description: z.string(),
                  })
                  .passthrough(),
              ),
            })
            .passthrough(),
          z
            .object({
              keyword: z.string(),
              ok: z.literal(false),
              error: z.string(),
            })
            .passthrough(),
        ]),
      ),
      ...optionalMetaOutputSchema,
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: Args, context) => {
    const results = await Promise.all(
      args.queries.map(async (q) => {
        try {
          const analysis = await KeywordResearchService.getSerpAnalysis(
            {
              projectId: args.projectId,
              keyword: q.keyword,
              ...resolveMarket(q, context.project),
            },
            context.billing,
          );
          // Trim noise — the traffic-value and backlink fields on the row are
          // null on every free row, so returning them would render a column of
          // blanks that reads as "zero".
          const items = analysis.items.slice(0, 20).map((item) => ({
            rank: item.rank,
            title: item.title,
            url: item.url,
            domain: item.domain,
            description: item.description,
          }));
          return {
            keyword: q.keyword,
            ok: true as const,
            source: analysis.source ?? null,
            notice: analysis.notice ?? null,
            items,
          };
        } catch (error) {
          return {
            keyword: q.keyword,
            ok: false as const,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    const okCount = results.filter((r) => r.ok).length;
    const text =
      results
        .map((r) => {
          if (!r.ok) {
            return `"${r.keyword}": FAILED — ${r.error}`;
          }
          const notice = r.notice ? `\n${r.notice}` : "";
          if (r.items.length === 0) {
            return `"${r.keyword}": your site had no Search Console impressions on this query in the window, which is missing data and not a ranking of zero.${notice}`;
          }
          return `"${r.keyword}" (${r.items.length} of your pages):${notice}\n${formatMcpTable(r.items, POSITION_COLUMNS)}`;
        })
        .join("\n\n") +
      `\n\n${okCount} of ${results.length} queries succeeded.`;

    return mcpResponse({
      text,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/keywords`,
      ),
      structuredContent: { results },
    });
  }),
};
