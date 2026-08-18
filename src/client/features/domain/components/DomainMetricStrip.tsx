import type { ReactNode } from "react";
import { Unavailable } from "@/client/features/domain/components/DomainNotices";
import type { DomainOverview } from "@/client/features/domain/hooks/useDomainOverviewQuery";

/**
 * The headline metric row.
 *
 * The design shows four figures — organic keywords, estimated monthly traffic,
 * traffic value and referring domains. Every one of them is modelled from a
 * licensed rank index, and this product runs on free sources, so all four come
 * back null with a reason attached. They keep their cells and render the
 * reason; the two numbers the free stack CAN measure follow them, each labelled
 * with the source it came from so nobody reads Google Ads targeting as a
 * ranking count.
 */

const COUNT_FORMAT = new Intl.NumberFormat();

/** Copy for the one design metric our API has no field for at all. */
const TRAFFIC_VALUE_UNAVAILABLE =
  "Traffic value prices a domain's ranked traffic against what the same clicks would cost as ads. It needs ranked positions, which no free source publishes for a domain you do not own.";

function MetricCell({
  label,
  value,
  last,
}: {
  label: ReactNode;
  value: ReactNode;
  last: boolean;
}) {
  return (
    <div
      style={{
        padding: "13px 20px",
        borderRight: last ? undefined : "1px solid var(--border-muted)",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{label}</div>
      <div
        style={{
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function DomainMetricStrip({ overview }: { overview: DomainOverview }) {
  // The E2E fixture payload has no `free` block, so the field is narrowed
  // rather than read off the union.
  const free = "free" in overview ? overview.free : undefined;
  const unavailable = free?.unavailable ?? {};

  const cells: Array<{ label: string; value: ReactNode }> = [
    {
      label: "Organic keywords",
      value:
        overview.organicKeywords == null ? (
          <Unavailable reason={unavailable.organicKeywords} />
        ) : (
          COUNT_FORMAT.format(overview.organicKeywords)
        ),
    },
    {
      label: "Est. monthly traffic",
      value:
        overview.organicTraffic == null ? (
          <Unavailable reason={unavailable.organicTraffic} />
        ) : (
          COUNT_FORMAT.format(Math.round(overview.organicTraffic))
        ),
    },
    {
      label: "Traffic value",
      value: <Unavailable reason={TRAFFIC_VALUE_UNAVAILABLE} />,
    },
    {
      label: "Referring domains",
      value:
        overview.referringDomains == null ? (
          <Unavailable reason={unavailable.referringDomains} />
        ) : (
          COUNT_FORMAT.format(overview.referringDomains)
        ),
    },
    {
      label: "Keywords targeted (Google Ads)",
      value:
        free?.googleAdsTargetedKeywords == null ? (
          <Unavailable reason={unavailable.googleAdsTargetedKeywords} />
        ) : (
          <>
            {COUNT_FORMAT.format(free.googleAdsTargetedKeywords)}
            {free.truncated ? (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-3)",
                  marginLeft: 6,
                }}
                title="Google capped the idea list, so this is a floor rather than a total."
              >
                +
              </span>
            ) : null}
          </>
        ),
    },
    {
      label: "Domain authority (OpenPageRank, 0-10)",
      value:
        free?.openPageRankAuthority == null ? (
          <Unavailable reason={unavailable.openPageRankAuthority} />
        ) : (
          free.openPageRankAuthority.toFixed(2)
        ),
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
        <MetricCell
          key={cell.label}
          label={cell.label}
          value={cell.value}
          last={index === cells.length - 1}
        />
      ))}
    </div>
  );
}

/** Same grid, same cell padding, so the strip does not jump when data lands. */
export function DomainMetricStripSkeleton() {
  return (
    <div
      aria-busy
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          style={{
            padding: "13px 20px",
            borderRight:
              index === 5 ? undefined : "1px solid var(--border-muted)",
          }}
        >
          <div className="skeleton" style={{ height: 11, width: "70%" }} />
          <div
            className="skeleton"
            style={{ height: 22, width: "45%", marginTop: 6 }}
          />
        </div>
      ))}
    </div>
  );
}
