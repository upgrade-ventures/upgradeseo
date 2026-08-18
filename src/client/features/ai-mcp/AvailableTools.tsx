import { GA4_OAUTH_APP_PENDING } from "@/shared/ga4";

/**
 * The MCP tool catalogue, as the server actually registers it.
 *
 * Every row below is a tool registered in `createUpgradeSeoMcpServer`
 * (src/server/mcp/server.ts), named exactly as an agent must call it, and
 * summarised from that tool's own `description`. Nothing is listed that the
 * server does not expose: an advertised tool an agent cannot call is a
 * fabricated capability, and this page is where people decide what to approve.
 */

type McpTool = {
  /** The callable name. What an agent, and an approval list, actually sees. */
  name: string;
  title: string;
  description: string;
};

type ToolCategory = {
  label: string;
  tools: McpTool[];
};

const toolCategories: ToolCategory[] = [
  {
    label: "Account and projects",
    tools: [
      {
        name: "whoami",
        title: "Who am I",
        description:
          "Confirm the signed-in user, organization, server mode and token scopes before doing anything else.",
      },
      {
        name: "list_projects",
        title: "List projects",
        description:
          "List every project in the organization. This is where a project ID for the other tools comes from.",
      },
      {
        name: "create_project",
        title: "Create project",
        description:
          "Create a project, optionally with a domain and a default market.",
      },
    ],
  },
  {
    label: "Keywords",
    tools: [
      {
        name: "research_keywords",
        title: "Research keywords",
        description:
          "Volume, difficulty, CPC and related ideas for up to five seed keywords in one call.",
      },
      {
        name: "get_keyword_metrics",
        title: "Get keyword metrics",
        description:
          "Volume, difficulty, intent, CPC and trend for a list of keywords you already have.",
      },
      {
        name: "list_saved_keywords",
        title: "List saved keywords",
        description:
          "Read a project's saved keywords, with cached metrics and tags where they exist.",
      },
      {
        name: "save_keywords",
        title: "Save keywords",
        description:
          "Save keywords back to a project. Re-saving one that is already there changes nothing.",
      },
    ],
  },
  {
    label: "Rank tracking",
    tools: [
      {
        name: "create_rank_tracker",
        title: "Create rank tracker",
        description:
          "Set up rank tracking for a project. An empty tracker starts no check on its own.",
      },
      {
        name: "get_rank_tracker",
        title: "Get rank tracker",
        description:
          "Read tracker configuration and the latest position snapshot per keyword.",
      },
      {
        name: "add_rank_tracking_keywords",
        title: "Add tracked keywords",
        description:
          "Add keywords to an existing tracker. The next scheduled run picks them up.",
      },
      {
        name: "remove_rank_tracking_keywords",
        title: "Remove tracked keywords",
        description:
          "Stop tracking keywords by ID. Snapshots already recorded are kept.",
      },
      {
        name: "run_rank_tracker",
        title: "Run a rank check",
        description:
          "Start a live check for every tracked keyword and device. Positions come from the free sources you have connected.",
      },
    ],
  },
  {
    label: "Domains and backlinks",
    tools: [
      {
        name: "get_domain_overview",
        title: "Get domain overview",
        description:
          "A domain's organic footprint: estimated traffic, keyword count, backlinks and referring domains.",
      },
      {
        name: "get_domain_keyword_suggestions",
        title: "Get domain keyword opportunities",
        description:
          "The organic keywords a domain ranks for, with position and whatever metrics are available.",
      },
      {
        name: "get_backlinks_overview",
        title: "Get backlinks overview",
        description:
          "Referring domain count, authority and the referring domains themselves.",
      },
      {
        name: "get_backlinks_profile",
        title: "Get backlinks profile",
        description:
          "One page of individual backlink rows: linking URL, target, anchor and linking-domain authority.",
      },
    ],
  },
  {
    label: "Search Console",
    tools: [
      {
        name: "get_serp_results",
        title: "Get your search positions",
        description:
          "The pages of your own verified site that Google ranks for a keyword, with position, impressions and clicks.",
      },
      {
        name: "get_search_console_performance",
        title: "Get Search Console performance",
        description:
          "Clicks, impressions, CTR and average position by query, page, country, device or date.",
      },
      {
        name: "inspect_urls",
        title: "Inspect URLs",
        description:
          "Index and coverage state, last crawl and canonical for up to ten URLs of the connected property.",
      },
    ],
  },
  {
    label: "Site audit",
    tools: [
      {
        name: "run_site_audit",
        title: "Run site audit",
        description:
          "Crawl the site, same-origin and robots.txt-aware, and check every page for SEO issues.",
      },
      {
        name: "get_audit_status",
        title: "Get site audit status",
        description:
          "Where a crawl has got to: phase, pages crawled and Lighthouse progress.",
      },
      {
        name: "get_audit_issues",
        title: "Get site audit issues",
        description:
          "The prioritized issue report, each issue carrying concrete remediation steps.",
      },
      {
        name: "get_audit_pages",
        title: "Get site audit pages",
        description:
          "Crawled pages with per-page data: status, title, description, word count, indexability and depth.",
      },
    ],
  },
  {
    label: "Google Analytics",
    tools: [
      {
        name: "get_google_analytics_organic_overview",
        title: "Get organic overview",
        description:
          "Whether organic is improving: sessions, users, engagement, key events and revenue against the previous period.",
      },
      {
        name: "get_google_analytics_organic_landing_pages",
        title: "Get organic landing pages",
        description:
          "Organic sessions, engagement, key events, transactions and revenue by landing page.",
      },
      {
        name: "get_google_analytics_page_performance",
        title: "Get page performance",
        description:
          "Page views, users, engagement duration and key events, organic by default.",
      },
      {
        name: "get_google_analytics_key_events",
        title: "Get key events",
        description:
          "Active key events with counts and users, by event or by organic landing page.",
      },
      {
        name: "get_google_analytics_traffic_acquisition",
        title: "Get traffic acquisition",
        description:
          "Sessions by channel group, source and medium, or campaign, with outcomes.",
      },
      {
        name: "get_google_analytics_audience_breakdown",
        title: "Get audience breakdown",
        description:
          "Device, country, or new versus returning users, sessions, engagement and key events.",
      },
      {
        name: "get_google_analytics_ecommerce_performance",
        title: "Get ecommerce performance",
        description:
          "Item views, add-to-cart units, purchases and revenue by item, or transactions by landing page.",
      },
      {
        name: "get_google_analytics_site_search",
        title: "Get site search",
        description:
          "Measured internal search terms with search events, users and engagement.",
      },
      {
        name: "get_google_analytics_measurement_health",
        title: "Check measurement health",
        description:
          "Data streams, enhanced measurement, key events and custom definitions on the connected property.",
      },
      {
        name: "get_search_opportunities",
        title: "Get search opportunities",
        description:
          "Join Search Console pages ranking 4 to 20 with Analytics outcomes and score what to work on.",
      },
    ],
  },
];

const visibleCategories = GA4_OAUTH_APP_PENDING
  ? toolCategories.filter((category) => category.label !== "Google Analytics")
  : toolCategories;

export function AvailableTools() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
        gap: 20,
      }}
    >
      {visibleCategories.map((category) => (
        <div key={category.label}>
          <h3
            style={{
              margin: "0 0 9px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            {category.label}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {category.tools.map((tool) => (
              <li key={tool.name} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {tool.title}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-3)",
                    // The name an agent calls, and the one an approval list
                    // shows. Wraps rather than overflowing on a narrow column.
                    overflowWrap: "anywhere",
                  }}
                >
                  {tool.name}
                </div>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 12,
                    color: "var(--text-2)",
                  }}
                >
                  {tool.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
