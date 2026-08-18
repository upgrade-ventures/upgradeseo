import { memo, useCallback, useRef } from "react";
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
  tdLeadAfterSelect,
  tdNumeric,
  tdNumericMuted,
  tdSelect,
  tdTrail,
  thMiddle,
  thNumeric,
  thTrail,
} from "@/client/features/domain/components/domainTableStyles";
import { useDomainRenderDebug } from "@/client/features/domain/domainDebug";
import { formatNumber, formatRounded } from "@/client/features/domain/utils";
import type {
  DomainSortMode,
  KeywordRow,
  SortOrder,
} from "@/client/features/domain/types";

type Props = {
  rows: KeywordRow[];
  selectedKeywords: Set<string>;
  sortMode: DomainSortMode;
  currentSortOrder: SortOrder;
  /** Why a column is empty on every row, keyed by field. From the server. */
  unavailable: Record<string, string> | undefined;
  onSortClick: (sort: DomainSortMode) => void;
  onToggleKeyword: (keyword: string) => void;
};

/**
 * Keyword difficulty bands.
 *
 * The design exercises only danger (84, 79) and warning (61, 58) and states no
 * thresholds. These cut-offs are ours, chosen to match those four samples and
 * the usual 0-100 reading of difficulty; they are the one number on this screen
 * the design left undefined.
 */
function difficultyTone(value: number): "danger" | "warning" | "success" {
  if (value >= 70) return "danger";
  if (value >= 40) return "warning";
  return "success";
}

function KdPill({ value }: { value: number }) {
  const tone = difficultyTone(value);
  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.01em",
        fontSize: 11.5,
        fontWeight: 600,
        color: `var(--${tone})`,
        background: `var(--${tone}-soft)`,
        border: `1px solid var(--${tone}-border)`,
        borderRadius: 5,
        padding: "1px 6px",
      }}
    >
      {value}
    </span>
  );
}

const checkboxStyle = {
  width: 13,
  height: 13,
  margin: 0,
  accentColor: "var(--accent)",
  cursor: "pointer",
  outline: "none",
  borderRadius: 3,
} as const;

function DomainKeywordsTableComponent({
  rows,
  selectedKeywords,
  sortMode,
  currentSortOrder,
  unavailable,
  onSortClick,
  onToggleKeyword,
}: Props) {
  // Anchor for shift-click range selection, the one table behaviour that needs
  // to remember which row the user touched last.
  const anchorIndex = useRef<number | null>(null);
  const allSelected =
    rows.length > 0 && rows.every((row) => selectedKeywords.has(row.keyword));
  const someSelected = rows.some((row) => selectedKeywords.has(row.keyword));

  const toggleRow = useCallback(
    (index: number, shiftKey: boolean) => {
      const row = rows[index];
      if (!row) return;
      const shouldSelect = !selectedKeywords.has(row.keyword);
      const from =
        shiftKey && anchorIndex.current != null ? anchorIndex.current : index;
      const [start, end] = from <= index ? [from, index] : [index, from];
      for (let i = start; i <= end; i += 1) {
        const target = rows[i];
        if (!target) continue;
        if (selectedKeywords.has(target.keyword) !== shouldSelect) {
          onToggleKeyword(target.keyword);
        }
      }
      anchorIndex.current = index;
    },
    [onToggleKeyword, rows, selectedKeywords],
  );

  const toggleAll = useCallback(() => {
    const shouldSelect = !allSelected;
    for (const row of rows) {
      if (selectedKeywords.has(row.keyword) !== shouldSelect) {
        onToggleKeyword(row.keyword);
      }
    }
    anchorIndex.current = null;
  }, [allSelected, onToggleKeyword, rows, selectedKeywords]);

  useDomainRenderDebug("DomainKeywordsTable", {
    rows: rows.length,
    selectedCount: selectedKeywords.size,
    sortMode,
    currentSortOrder,
  });

  if (rows.length === 0) {
    return (
      <TableEmptyState title="No keywords match this search.">
        Widen the filters, or try the domain without a location restriction.
      </TableEmptyState>
    );
  }

  const sortDirection = currentSortOrder === "asc" ? "ascending" : "descending";

  return (
    <div style={tableScrollShell}>
      <table style={dataTable}>
        <thead>
          <tr style={headRow}>
            <th
              scope="col"
              style={{ ...tdSelect, padding: "6px 8px 6px var(--pad, 24px)" }}
            >
              <input
                type="checkbox"
                style={checkboxStyle}
                checked={allSelected}
                ref={(node) => {
                  if (node) node.indeterminate = someSelected && !allSelected;
                }}
                onChange={toggleAll}
                // The count names this toggle's reach: the rows of this table,
                // not every keyword the domain ranks for.
                aria-label={`Select all ${rows.length} keyword${rows.length === 1 ? "" : "s"} in this table`}
                {...focusRing<HTMLInputElement>()}
              />
            </th>
            <th scope="col" style={thMiddle}>
              Keyword
            </th>
            <th
              scope="col"
              style={thNumeric}
              aria-sort={sortMode === "rank" ? sortDirection : "none"}
            >
              <SortableHeader
                label="Position"
                isActive={sortMode === "rank"}
                order={currentSortOrder}
                onClick={() => onSortClick("rank")}
                title={unavailable?.position}
              />
            </th>
            <th
              scope="col"
              style={thNumeric}
              aria-sort={sortMode === "volume" ? sortDirection : "none"}
            >
              <SortableHeader
                label="Volume"
                isActive={sortMode === "volume"}
                order={currentSortOrder}
                onClick={() => onSortClick("volume")}
                title="Average monthly searches, reported by Google."
              />
            </th>
            <th
              scope="col"
              style={thNumeric}
              aria-sort={sortMode === "cpc" ? sortDirection : "none"}
            >
              <SortableHeader
                label="CPC"
                isActive={sortMode === "cpc"}
                order={currentSortOrder}
                onClick={() => onSortClick("cpc")}
                title="Top-of-page bid in USD, reported by Google."
              />
            </th>
            <th
              scope="col"
              style={thNumeric}
              aria-sort={sortMode === "traffic" ? sortDirection : "none"}
            >
              <SortableHeader
                label="Traffic"
                isActive={sortMode === "traffic"}
                order={currentSortOrder}
                onClick={() => onSortClick("traffic")}
                title={unavailable?.traffic}
              />
            </th>
            <th
              scope="col"
              style={thNumeric}
              aria-sort={sortMode === "score" ? sortDirection : "none"}
            >
              <SortableHeader
                label="KD"
                isActive={sortMode === "score"}
                order={currentSortOrder}
                onClick={() => onSortClick("score")}
                title={
                  unavailable?.keywordDifficulty ??
                  "Organic ranking difficulty, 0 to 100."
                }
              />
            </th>
            <th scope="col" style={thTrail}>
              Ranking page
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const selected = selectedKeywords.has(row.keyword);
            const rankingPage = row.relativeUrl ?? row.url;
            return (
              <tr
                key={row.keyword}
                style={{
                  ...bodyRow,
                  // A selected row carries the accent tint and a 2px bar on its
                  // leading edge, so selection survives a greyscale display.
                  ...(selected
                    ? {
                        background: "var(--accent-soft)",
                        boxShadow: "inset 2px 0 0 var(--accent)",
                      }
                    : null),
                }}
                {...(selected ? {} : rowHoverHandlers)}
              >
                <td style={tdSelect}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={selected}
                    onChange={() => undefined}
                    onClick={(event) => toggleRow(index, event.shiftKey)}
                    aria-label={`Select ${row.keyword}`}
                    {...focusRing<HTMLInputElement>()}
                  />
                </td>
                <td style={tdLeadAfterSelect}>{row.keyword}</td>
                <td style={tdNumeric}>
                  {row.position == null ? (
                    <Unavailable reason={unavailable?.position} />
                  ) : (
                    row.position
                  )}
                </td>
                <td style={tdNumericMuted}>
                  {row.searchVolume == null ? (
                    <Unavailable />
                  ) : (
                    formatNumber(row.searchVolume)
                  )}
                </td>
                <td style={tdNumericMuted}>
                  {row.cpc == null ? <Unavailable /> : `$${row.cpc.toFixed(2)}`}
                </td>
                <td style={tdNumericMuted}>
                  {row.traffic == null ? (
                    <Unavailable reason={unavailable?.traffic} />
                  ) : (
                    formatRounded(row.traffic)
                  )}
                </td>
                <td style={{ ...tdNumeric, fontWeight: 400 }}>
                  {row.keywordDifficulty == null ? (
                    <Unavailable reason={unavailable?.keywordDifficulty} />
                  ) : (
                    <KdPill value={row.keywordDifficulty} />
                  )}
                </td>
                <td style={tdTrail}>
                  {rankingPage == null ? (
                    <Unavailable reason={unavailable?.url} />
                  ) : (
                    rankingPage
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const DomainKeywordsTable = memo(DomainKeywordsTableComponent);
