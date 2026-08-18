import { useMemo } from "react";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { NoValue } from "@/client/components/prominence/Primitives";
import {
  BacklinksDataTable,
  type BacklinksColumn,
  type BacklinksTableSort,
} from "./BacklinksDataTable";
import type { ReferringDomainRow } from "./backlinksPageTypes";
import type {
  BacklinksSortOrder,
  ReferringDomainsSortField,
} from "@/types/schemas/backlinks";
import { formatDecimal, formatNumber } from "./backlinksPageUtils";
import type { DomainRatings } from "./useAhrefsDomainRatings";

const TABLE_LINK = "link link-hover break-all inline-flex items-center gap-1";

/**
 * The design's link-lifecycle status: a 5px dot plus the word, at
 * 11.5px/600 in the tone's own colour. It is not the job pill — a link is not
 * a job — but it obeys the same rule that colour never carries the meaning.
 */
function LinkStatus({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        color: tone,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: "currentColor",
        }}
      />
      {label}
    </span>
  );
}

function getDomainWebsiteHref(domain: string) {
  try {
    return new URL(domain).toString();
  } catch {
    return `https://${domain}`;
  }
}

/**
 * Columns for the referring domains tab.
 *
 * "First seen" is the design's column and stays in place, but no free source
 * publishes link discovery dates, so it renders as unavailable rather than as
 * a date we would have had to invent. Status says only what Bing supports:
 * these are links it currently reports.
 */
function buildColumns(
  domainRatings: DomainRatings | null,
): BacklinksColumn<ReferringDomainRow>[] {
  const columns: BacklinksColumn<ReferringDomainRow>[] = [
    {
      key: "domain",
      header: "Domain",
      variant: "name",
      sortField: "domain" satisfies ReferringDomainsSortField,
      sortDefault: "asc",
      help: "The referring site linking to your target.",
      render: (row) =>
        row.domain ? (
          <SafeExternalLink
            url={getDomainWebsiteHref(row.domain)}
            label={row.domain}
            className={TABLE_LINK}
          />
        ) : (
          <NoValue />
        ),
    },
    {
      key: "rank",
      header: "DR",
      variant: "num",
      sortField: "rank" satisfies ReferringDomainsSortField,
      help: "Authority proxy for the referring domain on 0-100, from OpenPageRank. Not a licensed link-index rank.",
      render: (row) =>
        row.rank == null ? <NoValue /> : formatNumber(row.rank),
    },
    {
      key: "backlinks",
      header: "Links",
      variant: "numMuted",
      sortField: "backlinks" satisfies ReferringDomainsSortField,
      help: "Links from this domain among those Bing Webmaster Tools reports for the target.",
      render: (row) =>
        row.backlinks == null ? <NoValue /> : formatNumber(row.backlinks),
    },
    {
      key: "firstSeen",
      header: "First seen",
      variant: "date",
      help: "No free source publishes when a link was first discovered.",
      render: () => <NoValue />,
    },
    {
      key: "status",
      header: "Status",
      variant: "status",
      help: "Bing reports the links it currently sees. New and Lost need link history no free source publishes.",
      render: () => <LinkStatus tone="var(--text-2)" label="Live" />,
    },
  ];

  if (!domainRatings) return columns;

  const ratings = domainRatings;
  const drColumn: BacklinksColumn<ReferringDomainRow> = {
    key: "ahrefsDr",
    header: "Ahrefs DR",
    variant: "num",
    help: "Ahrefs Domain Rating (0-100) for this referring domain.",
    render: (row) => {
      const dr = row.domain ? (ratings[row.domain] ?? null) : null;
      return dr == null ? <NoValue /> : formatDecimal(dr);
    },
  };
  const insertAt = columns.findIndex((column) => column.key === "rank") + 1;
  return [...columns.slice(0, insertAt), drColumn, ...columns.slice(insertAt)];
}

export function ReferringDomainsTable({
  rows,
  domainRatings,
  sort,
  onSortChange,
  loading,
}: {
  rows: ReferringDomainRow[];
  domainRatings: DomainRatings | null;
  sort: BacklinksTableSort;
  onSortChange: (field: string, order: BacklinksSortOrder) => void;
  loading: boolean;
}) {
  const columns = useMemo(() => buildColumns(domainRatings), [domainRatings]);

  return (
    <BacklinksDataTable
      caption="Referring domains"
      columns={columns}
      rows={rows}
      getRowKey={(row, index) => row.domain ?? `row-${index}`}
      sort={sort}
      onSortChange={onSortChange}
      endGutter
      loading={loading}
      emptyLabel="No referring domains match this filter."
    />
  );
}
