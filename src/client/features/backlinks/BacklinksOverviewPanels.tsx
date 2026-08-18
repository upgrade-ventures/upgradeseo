import { Card, NoValue } from "@/client/components/prominence/Primitives";
import {
  BacklinksNewLostChart,
  BacklinksTrendChart,
} from "./BacklinksPageCharts";
import type { BacklinksOverviewData } from "./backlinksPageTypes";
import { formatNumber } from "./backlinksPageUtils";

/**
 * The counter strip above the referring-domains table.
 *
 * The design shows four counters with period deltas. Only two of them have a
 * free source: referring domains (OpenPageRank) and backlinks (Bing Webmaster
 * Tools, and only when it can list every page of the site). Dofollow share and
 * lost domains need rel attributes and link history that no free source
 * publishes, so they render as unavailable instead of as a zero. Nothing here
 * has a comparison period either, so no deltas are shown.
 */
export function BacklinksStatStrip({ data }: { data: BacklinksOverviewData }) {
  const cells: { label: string; value: React.ReactNode; note?: string }[] = [
    {
      label: "Referring domains",
      value:
        data.summary.referringDomains == null ? (
          <NoValue />
        ) : (
          formatNumber(data.summary.referringDomains)
        ),
      note: "Unique domains linking to this site, from OpenPageRank.",
    },
    {
      label: "Backlinks",
      value:
        data.summary.backlinks == null ? (
          <NoValue />
        ) : (
          formatNumber(data.summary.backlinks)
        ),
      note: "Inbound links Bing Webmaster Tools reports for the verified site.",
    },
    {
      label: "Domain authority",
      value:
        data.summary.rank == null ? (
          <NoValue />
        ) : (
          formatNumber(data.summary.rank)
        ),
      note: "Authority proxy on 0-100 (OpenPageRank, or the keyless Ahrefs Domain Rating). Not a licensed link-index rank.",
    },
    {
      label: "Dofollow",
      value: <NoValue />,
      note: "Follow status comes from a link's rel attributes, which no free source reports.",
    },
    {
      label: "Lost this month",
      value: <NoValue />,
      note: "Lost links need link history, which no free source publishes.",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          title={cell.note}
          style={{
            padding: "13px 20px",
            borderRight:
              index === cells.length - 1
                ? undefined
                : "1px solid var(--border-muted)",
          }}
        >
          <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
            {cell.label}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.01em",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Authority history from OpenPageRank. Only domain lookups have it: every free
 * authority source rates a domain, so a single page gets no series at all.
 */
export function BacklinksTrendPanels({
  data,
}: {
  data: BacklinksOverviewData;
}) {
  if (data.scope !== "domain") return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        padding: "14px var(--pad, 24px)",
      }}
    >
      <Card title="Domain authority trend" note="OpenPageRank monthly history">
        <div style={{ padding: 12 }}>
          <BacklinksTrendChart data={data.trends} />
        </div>
      </Card>
      {data.newLostTrends.length > 0 ? (
        <Card title="New vs lost" note="Link acquisition and attrition">
          <div style={{ padding: 12 }}>
            <BacklinksNewLostChart data={data.newLostTrends} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
