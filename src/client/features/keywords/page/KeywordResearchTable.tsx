import { useState, type CSSProperties } from "react";
import { formatNumber } from "@/client/features/keywords/utils";
import type { KeywordResearchRow } from "@/types/keywords";
import type { SortField } from "@/client/features/keywords/components";
import {
  DifficultyBadge,
  IntentTag,
  NoCellValue,
  NUMERIC_CELL,
  TableCheckbox,
} from "./keywordTableCells";
import { GhostButton, useFocusRing } from "./prominenceControls";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
  /** The rows of the current page, already filtered and sorted. */
  pageRows: KeywordResearchRow[];
};

const HEAD_TEXT: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

export function KeywordResearchTable({ controller, pageRows }: Props) {
  const {
    activeFilterCount,
    filteredRows,
    overviewKeyword,
    selectedRows,
    toggleAllRows,
    toggleRowSelection,
  } = controller;
  // One hovered key rather than per-row state: the design carries row hover as
  // a style-hover attribute and screens must not add shared CSS.
  const [hovered, setHovered] = useState<string | null>(null);

  const selectedOnPage = filteredRows.filter((row) =>
    selectedRows.has(row.keyword),
  ).length;
  const allSelected =
    filteredRows.length > 0 && selectedOnPage === filteredRows.length;

  return (
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table
        style={{
          width: "100%",
          minWidth: 560,
          borderCollapse: "collapse",
          fontSize: 12.5,
        }}
      >
        <thead>
          <tr
            style={{
              background: "var(--subtle)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <th style={{ width: 32, padding: "6px 0 6px var(--pad, 24px)" }}>
              <TableCheckbox
                checked={allSelected}
                // The design has no partial state; leaving one out would make a
                // half-ticked table read as untouched.
                indeterminate={!allSelected && selectedOnPage > 0}
                onChange={toggleAllRows}
                label={`Select all ${filteredRows.length} keywords in this table`}
              />
            </th>
            <SortableHeader
              controller={controller}
              field="keyword"
              label="Keyword"
              style={{ textAlign: "left", padding: "6px 8px" }}
            />
            <SortableHeader
              controller={controller}
              field="searchVolume"
              label="Volume"
              style={{ textAlign: "right", padding: "6px 8px" }}
            />
            <SortableHeader
              controller={controller}
              field="cpc"
              label="CPC"
              title="Cost per click reported by the connected ads account."
              style={{ textAlign: "right", padding: "6px 8px" }}
            />
            <SortableHeader
              controller={controller}
              field="competition"
              label="Comp."
              title="Paid-search competition (0-1): higher means more advertisers bidding."
              style={{ textAlign: "right", padding: "6px 8px" }}
            />
            <SortableHeader
              controller={controller}
              field="keywordDifficulty"
              label="KD"
              title="Organic ranking difficulty (0-100)."
              style={{ textAlign: "right", padding: "6px 8px" }}
            />
            <th
              style={{
                ...HEAD_TEXT,
                textAlign: "center",
                padding: "6px var(--pad, 24px) 6px 8px",
              }}
            >
              Intent
            </th>
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: "28px var(--pad, 24px)" }}>
                <p
                  style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}
                >
                  No keywords match the filters you have on.
                </p>
                {activeFilterCount > 0 ? (
                  <GhostButton
                    style={{ marginTop: 6, marginLeft: -9 }}
                    onClick={controller.resetFilters}
                  >
                    Clear filters
                  </GhostButton>
                ) : null}
              </td>
            </tr>
          ) : (
            pageRows.map((row) => {
              const open = overviewKeyword?.keyword === row.keyword;
              const selected = selectedRows.has(row.keyword);
              return (
                <tr
                  key={row.keyword}
                  onMouseEnter={() => setHovered(row.keyword)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => controller.handleRowClick(row)}
                  style={{
                    borderBottom: "1px solid var(--border-muted)",
                    // Selection is what the bar above the table acts on, so it
                    // takes the accent tint and the leading bar. The open row
                    // is only where the detail panel is pointed, and reads as
                    // the quieter inset fill.
                    ...(selected
                      ? {
                          background: "var(--accent-soft)",
                          boxShadow: "inset 2px 0 0 var(--accent)",
                        }
                      : open
                        ? { background: "var(--inset)" }
                        : hovered === row.keyword
                          ? { background: "var(--subtle)" }
                          : null),
                  }}
                >
                  <td
                    style={{
                      padding:
                        "var(--rp, 5px) 0 var(--rp, 5px) var(--pad, 24px)",
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <TableCheckbox
                      checked={selected}
                      onChange={() => toggleRowSelection(row.keyword)}
                      label={`Select ${row.keyword}`}
                    />
                  </td>
                  <td
                    style={{ padding: "var(--rp, 5px) 8px", fontWeight: 600 }}
                  >
                    <KeywordCellButton
                      keyword={row.keyword}
                      open={open}
                      onClick={() => controller.handleRowClick(row)}
                    />
                  </td>
                  <td style={NUMERIC_CELL}>
                    {row.searchVolume === null ? (
                      <NoCellValue reason="No search volume reported for this keyword." />
                    ) : (
                      formatNumber(row.searchVolume)
                    )}
                  </td>
                  <td style={NUMERIC_CELL}>
                    {row.cpc === null ? (
                      <NoCellValue reason="No cost-per-click reported for this keyword." />
                    ) : (
                      row.cpc.toFixed(2)
                    )}
                  </td>
                  <td style={NUMERIC_CELL}>
                    {row.competition === null ? (
                      <NoCellValue reason="No competition figure reported for this keyword." />
                    ) : (
                      row.competition.toFixed(2)
                    )}
                  </td>
                  <td
                    style={{
                      padding: "var(--rp, 5px) 8px",
                      textAlign: "right",
                    }}
                  >
                    {row.keywordDifficulty === null ? (
                      <NoCellValue reason="Keyword difficulty is not available from the data sources connected to this project." />
                    ) : (
                      <DifficultyBadge value={row.keywordDifficulty} />
                    )}
                  </td>
                  <td
                    style={{
                      padding:
                        "var(--rp, 5px) var(--pad, 24px) var(--rp, 5px) 8px",
                      textAlign: "center",
                    }}
                  >
                    {row.intent === "unknown" ? (
                      <NoCellValue reason="Search intent is not available from the data sources connected to this project." />
                    ) : (
                      <IntentTag intent={row.intent} />
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  controller,
  field,
  label,
  title,
  style,
}: {
  controller: KeywordResearchControllerState;
  field: SortField;
  label: string;
  title?: string;
  style: CSSProperties;
}) {
  const { ring, ringProps } = useFocusRing();
  const active = controller.sortField === field;
  const ascending = controller.sortDir === "asc";

  return (
    <th
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
      style={{ ...HEAD_TEXT, ...style }}
    >
      <button
        type="button"
        title={title}
        onClick={() => controller.toggleSort(field)}
        {...ringProps}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          font: "inherit",
          color: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          cursor: "pointer",
          borderRadius: 4,
          ...ring,
        }}
      >
        {label}
        {active ? (ascending ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function KeywordCellButton({
  keyword,
  open,
  onClick,
}: {
  keyword: string;
  open: boolean;
  onClick: () => void;
}) {
  const { ring, ringProps } = useFocusRing();

  return (
    <button
      type="button"
      // The row itself is clickable for the mouse; this keeps the same action
      // reachable from the keyboard without breaking the row's table semantics.
      aria-expanded={open}
      aria-controls="keyword-detail-panel"
      title={keyword}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      {...ringProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "max(20px, var(--tap, 0px))",
        border: "none",
        background: "none",
        padding: 0,
        font: "inherit",
        fontWeight: 600,
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 4,
        ...ring,
      }}
    >
      {keyword}
    </button>
  );
}
