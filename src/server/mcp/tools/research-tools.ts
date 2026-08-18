import { z } from "zod";
import { resolveFreeSeoEnv } from "@/server/lib/free-seo/resolveFreeSeoEnv";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { formatMcpTable, type McpTableColumn } from "@/server/mcp/table";
import { AppError } from "@/server/lib/errors";
import { createFreeSeoProvider } from "@/server/lib/free-seo/provider";
import { locationCodeSchema, projectIdSchema } from "@/server/mcp/schemas";

// One upstream call per keyword: neither free source has a bulk-metrics
// endpoint, so the batch is capped far below the old provider's 700 to keep a
// single tool call bounded.
const MAX_KEYWORDS = 50;

const keywordMetricsSortSchema = z.enum([
  "search_volume",
  "cpc",
  "competition",
]);

const getKeywordMetricsInputSchema = {
  projectId: projectIdSchema,
  keywords: z
    .array(z.string().min(1).max(80))
    .min(1)
    .max(MAX_KEYWORDS)
    .describe(
      `Keywords to fetch metrics for (1-${MAX_KEYWORDS}). Each keyword costs one call to the connected free source, so keep batches focused.`,
    ),
  locationCode: locationCodeSchema.optional(),
  includeMonthlyTrends: z
    .boolean()
    .optional()
    .describe(
      "Include monthly search-volume trend rows. Defaults to true. Google Ads supplies the trend; Bing does not, and its rows carry an empty trend.",
    ),
  sortBy: keywordMetricsSortSchema
    .optional()
    .describe(
      "Sort order for returned rows. Defaults to search_volume. Rows with no value for the chosen field sort last.",
    ),
} as const;

type GetKeywordMetricsArgs = z.infer<
  z.ZodObject<typeof getKeywordMetricsInputSchema>
>;

// The MCP row shape, kept snake_case for client stability. Keyword difficulty
// and search intent are absent rather than null: no free source produces
// either for an arbitrary keyword, so the tool must not offer the fields at
// all and invite a caller to read an empty column as "easy" or "unknown".
type KeywordMetricOutputRow = {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number | null;
  }> | null;
};

// Nulls sort last rather than being coerced to 0: a keyword the source has no
// CPC for is not the cheapest keyword in the list.
function sortKeywordMetricRows(
  rows: KeywordMetricOutputRow[],
  sortBy: NonNullable<GetKeywordMetricsArgs["sortBy"]> = "search_volume",
) {
  return rows.toSorted((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return bValue - aValue;
  });
}

/** The columns render every field except the trend, so the table is the same
 *  whether or not monthly_searches was asked for. */
type KeywordMetricTableRow = Omit<KeywordMetricOutputRow, "monthly_searches">;

const KEYWORD_METRIC_COLUMNS: McpTableColumn<KeywordMetricTableRow>[] = [
  { header: "keyword", value: (row) => row.keyword },
  { header: "volume", value: (row) => row.search_volume },
  { header: "CPC", value: (row) => row.cpc },
  { header: "competition", value: (row) => row.competition },
];

/**
 * Builds the free provider from this organization's stored keys.
 *
 * The provider-keys module is imported dynamically because it reaches the
 * database, and this module's pure row mappers are unit-tested without a D1
 * binding. Mirrors freeKeywordMetrics in research/refresh-metrics.ts.
 */
async function resolveFreeProvider(organizationId: string) {
  return createFreeSeoProvider(await resolveFreeSeoEnv(organizationId));
}

/**
 * What the numbers in the table actually are. Bing reports its own
 * impressions, which are a demand proxy and NOT Google search volume, so the
 * caller is told which of the two it is looking at before it reads a row.
 */
function sourceNotice(
  volumeSource: "microsoft_ads" | "google_ads" | "bing",
): string {
  if (volumeSource === "microsoft_ads") {
    return 'Source: Microsoft Advertising. volume = real monthly searches on Microsoft/Bing (NOT Google), CPC = suggested bid, competition = 0-1 from Microsoft\'s LOW/MEDIUM/HIGH; "—" = the source reported no value.';
  }
  return volumeSource === "google_ads"
    ? 'Source: Google Ads. volume = Google average monthly searches, CPC = top-of-page bid midpoint in USD, competition = paid competition (0-1); "—" = the source reported no value.'
    : "Source: Bing Webmaster. volume = BING impressions over Bing's reporting window, a demand proxy and NOT Google search volume. Bing publishes no CPC or competition, so both columns are empty for every row.";
}

export const getKeywordMetricsTool = {
  name: "get_keyword_metrics",
  config: {
    title: "Get keyword metrics",
    description:
      "Hydrate known keywords with search volume, CPC, paid competition, and monthly trends from the connected free source. Use it to score candidate or known keywords — including Search Console striking-distance queries — by real demand. Microsoft Advertising gives real volume and CPC on Microsoft/Bing and needs no approval; Google Ads gives the same for Google where approved; failing both, Bing Webmaster impressions stand in as a demand proxy, labelled as Bing. Keyword difficulty and search intent are not returned: no free source produces either for an arbitrary keyword. Keywords the source does not know are dropped rather than reported as zero.",
    inputSchema: getKeywordMetricsInputSchema,
    outputSchema: {
      keywords: z.array(looseObjectOutputSchema),
      volumeSource: z.string(),
      ...optionalMetaOutputSchema,
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: GetKeywordMetricsArgs, context) => {
    // Language is not a selector here: the free sources pick their own
    // language from the market table keyed by location, so accepting a
    // languageCode would mean accepting an argument nothing reads.
    const locationCode = args.locationCode ?? context.project.locationCode;
    const free = await resolveFreeProvider(context.auth.organizationId);
    if (!free.available) {
      throw new AppError(
        "DATA_SOURCE_NOT_CONFIGURED",
        "No keyword data source is connected. Add Google Ads for real Google volume and CPC, or a Bing Webmaster key for a faster start. Both are free.",
      );
    }

    // Sequential, not Promise.all: one request per keyword against a free
    // quota, and fanning fifty out at once is how a key gets rate-limited.
    const metrics: KeywordMetricOutputRow[] = [];
    for (const keyword of args.keywords) {
      const metric = await free.keywordVolume({ keyword, locationCode });
      if (!metric) continue;
      metrics.push({
        keyword: metric.keyword,
        search_volume: metric.searchVolume,
        cpc: metric.cpc,
        competition: metric.competition,
        monthly_searches: metric.trend.length
          ? metric.trend.map((entry) => ({
              year: entry.year,
              month: entry.month,
              search_volume: entry.searchVolume,
            }))
          : null,
      });
    }

    const sorted = sortKeywordMetricRows(
      metrics,
      args.sortBy ?? "search_volume",
    );
    const rows: Array<KeywordMetricOutputRow | KeywordMetricTableRow> =
      args.includeMonthlyTrends === false
        ? sorted.map(({ monthly_searches: _trend, ...rest }) => rest)
        : sorted;

    const missing = args.keywords.length - rows.length;
    const header = [
      `Fetched metrics for ${rows.length} of ${args.keywords.length} keywords.`,
      missing > 0
        ? `${missing} keyword(s) are absent from the source's index and were dropped rather than returned as zero.`
        : null,
      sourceNotice(free.volumeSource),
    ]
      .filter((line) => line !== null)
      .join(" ");

    return mcpResponse({
      text:
        rows.length === 0
          ? header
          : `${header}\n${formatMcpTable<KeywordMetricTableRow>(rows, KEYWORD_METRIC_COLUMNS)}`,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/keywords`,
      ),
      structuredContent: { keywords: rows, volumeSource: free.volumeSource },
    });
  }),
};
