import { useMemo } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { NoValue, StatusPill } from "@/client/components/prominence/Primitives";
import {
  BacklinksDataTable,
  useFocusRing,
  type BacklinksColumn,
  type BacklinksTableSort,
} from "./BacklinksDataTable";
import { BacklinksSourceLink } from "./BacklinksPageLinks";
import type { BacklinksRow } from "./backlinksPageTypes";
import type {
  BacklinksRowsSortField,
  BacklinksSortOrder,
} from "@/types/schemas/backlinks";
import { formatDecimal, formatNumber } from "./backlinksPageUtils";
import type { BacklinksDomainExpansion } from "./useBacklinksDomainExpansion";
import type { DomainRatings } from "./useAhrefsDomainRatings";

/**
 * Row model for the backlinks table. In the one-per-domain view, depth-0 rows
 * are each domain's strongest link and can expand into the domain's remaining
 * links (depth-1) plus a transient status row while they load.
 */
type BacklinksDisplayRow =
  | {
      kind: "link";
      row: BacklinksRow;
      depth: 0 | 1;
      expandable: boolean;
      expanded: boolean;
    }
  | { kind: "status"; domain: string; status: "loading" | "error" | "empty" };

/** Interleaves expanded domains' extra links beneath their page row. */
function buildDisplayRows(
  rows: BacklinksRow[],
  expansion: BacklinksDomainExpansion | null,
): BacklinksDisplayRow[] {
  if (!expansion) {
    return rows.map((row) => ({
      kind: "link",
      row,
      depth: 0,
      expandable: false,
      expanded: false,
    }));
  }

  const out: BacklinksDisplayRow[] = [];
  for (const row of rows) {
    const domain = row.domainFrom;
    const expanded = Boolean(domain && expansion.expandedDomains.has(domain));
    out.push({
      kind: "link",
      row,
      depth: 0,
      expandable: Boolean(domain),
      expanded,
    });
    if (!expanded || !domain) continue;

    const entry = expansion.entriesByDomain[domain];
    if (!entry || entry.status === "loading") {
      out.push({ kind: "status", domain, status: "loading" });
    } else if (entry.status === "error") {
      out.push({ kind: "status", domain, status: "error" });
    } else {
      // The page row already shows the domain's strongest link; list the rest.
      const children = entry.rows.filter(
        (child) =>
          !(
            child.urlFrom === row.urlFrom &&
            child.urlTo === row.urlTo &&
            child.anchor === row.anchor
          ),
      );
      if (children.length === 0) {
        out.push({ kind: "status", domain, status: "empty" });
      } else {
        for (const child of children) {
          out.push({
            kind: "link",
            row: child,
            depth: 1,
            expandable: false,
            expanded: false,
          });
        }
      }
    }
  }
  return out;
}

function ExpandButton({
  domain,
  expanded,
  onToggle,
}: {
  domain: string;
  expanded: boolean;
  onToggle: (domain: string) => void;
}) {
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <button
      type="button"
      aria-label={`${expanded ? "Hide" : "Show"} all links from ${domain}`}
      aria-expanded={expanded}
      onClick={() => onToggle(domain)}
      {...focusProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        marginLeft: -2,
        padding: 0,
        border: "none",
        borderRadius: 4,
        background: "none",
        color: "var(--text-2)",
        cursor: "pointer",
        flexShrink: 0,
        ...focusStyle,
      }}
    >
      <Icon
        name="i-chev-right"
        size={13}
        style={{
          transform: expanded ? "rotate(90deg)" : undefined,
          transition: "transform 120ms ease",
        }}
      />
    </button>
  );
}

const STATUS_ROW_TEXT: Record<"loading" | "error" | "empty", string> = {
  loading: "Loading this domain's links...",
  error: "Couldn't load this domain's links.",
  empty: "No other links from this domain.",
};

function SourceCell({
  displayRow,
  onToggleDomain,
}: {
  displayRow: BacklinksDisplayRow;
  onToggleDomain?: (domain: string) => void;
}) {
  if (displayRow.kind === "status") {
    return (
      <span
        style={{
          paddingLeft: 22,
          fontWeight: 400,
          color: "var(--text-2)",
        }}
      >
        {STATUS_ROW_TEXT[displayRow.status]}
      </span>
    );
  }

  const { row, depth, expandable, expanded } = displayRow;
  if (depth > 0) {
    return (
      <div style={{ paddingLeft: 22, fontWeight: 400 }}>
        {row.urlFrom ? (
          <BacklinksSourceLink url={row.urlFrom} maxLength={48} muted />
        ) : (
          <NoValue />
        )}
      </div>
    );
  }

  const domainLabel = row.domainFrom?.replace(/^www\./, "") ?? "";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
      {expandable && row.domainFrom && onToggleDomain ? (
        <ExpandButton
          domain={row.domainFrom}
          expanded={expanded}
          onToggle={onToggleDomain}
        />
      ) : null}
      <div style={{ minWidth: 0 }}>
        <div>{domainLabel || <NoValue />}</div>
        {row.urlFrom ? (
          <BacklinksSourceLink url={row.urlFrom} maxLength={48} muted />
        ) : null}
        <LinkFlags row={row} />
      </div>
    </div>
  );
}

/** Only rendered when a source actually reports one of these. */
function LinkFlags({ row }: { row: BacklinksRow }) {
  const flags = [
    row.isLost ? { tone: "danger" as const, label: "Lost" } : null,
    row.isBroken ? { tone: "warning" as const, label: "Broken" } : null,
    row.linksCount != null && row.linksCount > 1
      ? { tone: "neutral" as const, label: `${row.linksCount} links` }
      : null,
  ].filter((flag) => flag !== null);

  if (flags.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
      {flags.map((flag) => (
        <StatusPill key={flag.label} tone={flag.tone}>
          {flag.label}
        </StatusPill>
      ))}
    </div>
  );
}

/** Renders a cell only for link rows; expansion status rows leave it empty. */
function linkCell(render: (row: BacklinksRow) => React.ReactNode) {
  return (displayRow: BacklinksDisplayRow) =>
    displayRow.kind === "link" ? render(displayRow.row) : null;
}

function buildColumns(
  domainRatings: DomainRatings | null,
  onToggleDomain?: (domain: string) => void,
): BacklinksColumn<BacklinksDisplayRow>[] {
  const columns: BacklinksColumn<BacklinksDisplayRow>[] = [
    {
      key: "source",
      header: "Source page",
      variant: "name",
      help: "The page linking to your target.",
      render: (displayRow) => (
        <SourceCell displayRow={displayRow} onToggleDomain={onToggleDomain} />
      ),
    },
    {
      key: "target",
      header: "Target",
      variant: "text",
      help: "The page on the target site that receives the link.",
      render: linkCell((row) =>
        row.urlTo ? (
          <BacklinksSourceLink url={row.urlTo} maxLength={40} />
        ) : (
          <NoValue />
        ),
      ),
    },
    {
      key: "anchor",
      header: "Anchor",
      variant: "text",
      help: "The clickable text of the link.",
      render: linkCell((row) =>
        row.anchor?.trim() ? `“${row.anchor.trim()}”` : <NoValue />,
      ),
    },
    {
      key: "type",
      header: "Type",
      variant: "text",
      help: "Follow status comes from a link's rel attributes, which Bing Webmaster Tools does not report.",
      render: linkCell((row) =>
        row.isDofollow == null ? (
          <NoValue />
        ) : row.isDofollow ? (
          "Dofollow"
        ) : (
          "Nofollow"
        ),
      ),
    },
    {
      key: "domainRank",
      header: "DR",
      variant: "num",
      sortField: "domainRank" satisfies BacklinksRowsSortField,
      help: "Authority proxy for the linking domain on 0-100, from OpenPageRank. Not a licensed link-index rank.",
      render: linkCell((row) =>
        row.domainFromRank == null ? (
          <NoValue />
        ) : (
          formatNumber(row.domainFromRank)
        ),
      ),
    },
  ];

  if (!domainRatings) return columns;

  const ratings = domainRatings;
  return [
    ...columns,
    {
      key: "ahrefsDr",
      header: "Ahrefs DR",
      variant: "num",
      help: "Ahrefs Domain Rating (0-100) for the linking domain.",
      render: linkCell((row) => {
        const domain = row.domainFrom?.replace(/^www\./, "");
        const dr = domain ? (ratings[domain] ?? null) : null;
        return dr == null ? <NoValue /> : formatDecimal(dr);
      }),
    },
  ];
}

export function BacklinksTable({
  rows,
  domainRatings,
  sort,
  onSortChange,
  expansion,
  loading,
}: {
  rows: BacklinksRow[];
  domainRatings: DomainRatings | null;
  sort: BacklinksTableSort;
  onSortChange: (field: string, order: BacklinksSortOrder) => void;
  /** Present in the one-per-domain view; null when listing all links. */
  expansion: BacklinksDomainExpansion | null;
  loading: boolean;
}) {
  const columns = useMemo(
    () => buildColumns(domainRatings, expansion?.toggleDomain),
    [domainRatings, expansion?.toggleDomain],
  );
  const displayRows = useMemo(
    () => buildDisplayRows(rows, expansion),
    [rows, expansion],
  );

  return (
    <BacklinksDataTable
      caption="Backlinks"
      columns={columns}
      rows={displayRows}
      getRowKey={(displayRow, index) =>
        displayRow.kind === "status"
          ? `status-${displayRow.domain}`
          : `link-${index}-${displayRow.row.urlFrom ?? ""}`
      }
      sort={sort}
      onSortChange={onSortChange}
      loading={loading}
      emptyLabel="No backlinks match this filter."
      getRowStyle={(displayRow) =>
        displayRow.kind !== "link" || displayRow.depth > 0
          ? { background: "var(--subtle)" }
          : undefined
      }
    />
  );
}
