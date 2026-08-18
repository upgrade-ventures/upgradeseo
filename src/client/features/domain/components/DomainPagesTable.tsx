import { memo, useMemo } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import {
  Unavailable,
  TableEmptyState,
} from "@/client/features/domain/components/DomainNotices";
import { SortableHeader } from "@/client/features/domain/components/SortableHeader";
import {
  bodyRow,
  dataTable,
  focusRing,
  headRow,
  rowHoverHandlers,
  tableScrollShell,
  tdLead,
  tdPagesNumeric,
  thLead,
  thNumeric,
} from "@/client/features/domain/components/domainTableStyles";
import { useDomainRenderDebug } from "@/client/features/domain/domainDebug";
import {
  formatNumber,
  formatRounded,
  toPageSortMode,
} from "@/client/features/domain/utils";
import type {
  DomainSortMode,
  PageRow,
  SortOrder,
} from "@/client/features/domain/types";

type Props = {
  rows: PageRow[];
  sortMode: DomainSortMode;
  currentSortOrder: SortOrder;
  /** Why a column is empty on every row, keyed by field. From the server. */
  unavailable: Record<string, string> | undefined;
  onSortClick: (sort: DomainSortMode) => void;
};

/** Copy for the one design column our API has no field for at all. */
const TRAFFIC_VALUE_UNAVAILABLE =
  "Traffic value prices a page's ranked traffic against what the same clicks would cost as ads. It needs ranked positions, which no free source publishes for a domain you do not own.";

function DomainPagesTableComponent({
  rows,
  sortMode,
  currentSortOrder,
  unavailable,
  onSortClick,
}: Props) {
  // Memoized on purpose: a fresh slice every render defeats the memo below and
  // re-renders the whole table on every parent tick.
  const visibleRows = useMemo(() => rows.slice(0, 100), [rows]);
  useDomainRenderDebug("DomainPagesTable", {
    rows: rows.length,
    sortMode,
    currentSortOrder,
  });

  if (visibleRows.length === 0) {
    return (
      <TableEmptyState title="No pages match this search.">
        Common Crawl lists what a site publishes, so a very new or very small
        site can legitimately have nothing indexed yet.
      </TableEmptyState>
    );
  }

  const sortDirection = currentSortOrder === "asc" ? "ascending" : "descending";
  const pageSort = toPageSortMode(sortMode);

  return (
    <div style={tableScrollShell}>
      <table style={dataTable}>
        <thead>
          <tr style={headRow}>
            <th scope="col" style={thLead}>
              Page
            </th>
            <th
              scope="col"
              style={thNumeric}
              aria-sort={pageSort === "traffic" ? sortDirection : "none"}
            >
              <SortableHeader
                label="Est. traffic"
                isActive={pageSort === "traffic"}
                order={currentSortOrder}
                onClick={() => onSortClick("traffic")}
                title={unavailable?.organicTraffic}
              />
            </th>
            <th
              scope="col"
              style={thNumeric}
              aria-sort={pageSort === "keywords" ? sortDirection : "none"}
            >
              <SortableHeader
                label="Keywords"
                isActive={pageSort === "keywords"}
                order={currentSortOrder}
                onClick={() => onSortClick("volume")}
                title={unavailable?.keywords}
              />
            </th>
            <th
              scope="col"
              style={{
                ...thNumeric,
                padding: "6px var(--pad, 24px) 6px 12px",
              }}
            >
              Traffic value
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.page} style={bodyRow} {...rowHoverHandlers}>
              <td style={{ ...tdLead, textAlign: "left" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    maxWidth: 420,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={row.page}
                  >
                    {row.relativePath ?? row.page}
                  </span>
                  {/* The design draws paths as inert text. Opening the page is
                      an existing capability of this table, so it survives as an
                      icon link rather than by recolouring the path itself. */}
                  <a
                    href={row.page}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Open ${row.page} in a new tab`}
                    style={{
                      color: "var(--text-3)",
                      display: "inline-flex",
                      borderRadius: 3,
                      outline: "none",
                    }}
                    {...focusRing<HTMLAnchorElement>()}
                  >
                    <Icon name="i-external" size={12} />
                  </a>
                </span>
              </td>
              <td style={tdPagesNumeric}>
                {row.organicTraffic == null ? (
                  <Unavailable reason={unavailable?.organicTraffic} />
                ) : (
                  formatRounded(row.organicTraffic)
                )}
              </td>
              <td style={tdPagesNumeric}>
                {row.keywords == null ? (
                  <Unavailable reason={unavailable?.keywords} />
                ) : (
                  formatNumber(row.keywords)
                )}
              </td>
              <td
                style={{
                  ...tdPagesNumeric,
                  padding:
                    "var(--rp, 5px) var(--pad, 24px) var(--rp, 5px) 12px",
                }}
              >
                <Unavailable reason={TRAFFIC_VALUE_UNAVAILABLE} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const DomainPagesTable = memo(DomainPagesTableComponent);
