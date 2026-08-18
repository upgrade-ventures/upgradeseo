import { useRef, useState } from "react";

import { Icon } from "@/client/components/icons/IconSprite";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { SavedTableRow } from "@/client/features/saved/SavedTableRow";
import {
  Checkbox,
  HEAD_ROW,
  ROW_LINE,
  SCROLLER,
  SkeletonBar,
  SR_ONLY,
  TABLE,
  TD,
  TH,
  TH_RIGHT,
  useFocusRing,
} from "@/client/features/saved/savedParts";
import type { SavedKeywordRow } from "@/types/keywords";
import type { GetSavedKeywordsInput } from "@/types/schemas/keywords";

export type SavedSortField = NonNullable<GetSavedKeywordsInput["sort"]>;

type SortableColumn = {
  id: Exclude<SavedSortField, "createdAt">;
  label: string;
  numeric: boolean;
  help?: string;
};

const SORTABLE_COLUMNS: SortableColumn[] = [
  { id: "keyword", label: "Keyword", numeric: false },
  { id: "searchVolume", label: "Volume", numeric: true },
  { id: "cpc", label: "CPC", numeric: true },
  {
    id: "competition",
    label: "Competition",
    numeric: true,
    help: "Paid-search competition from Google Ads (0-1): higher means more advertisers bidding.",
  },
  {
    id: "keywordDifficulty",
    label: "Difficulty",
    numeric: true,
    help: "Organic ranking difficulty (0-100): higher means harder to reach Google's top 10.",
  },
];

const COLUMN_COUNT = 9;

/**
 * The saved-keyword table.
 *
 * Sorting and paging are the server's, so a header click re-queries rather than
 * re-ordering what is on screen. Every cell renders the measurement or the
 * design's unavailable marker; nothing is filled in with a zero.
 */
export function SavedTable({
  rows,
  sort,
  order,
  selectedIds,
  isLoading,
  isError,
  errorMessage,
  hasActiveFilters,
  onSortChange,
  onSelectionChange,
  onRetry,
}: {
  rows: SavedKeywordRow[];
  sort: SavedSortField;
  order: "asc" | "desc";
  selectedIds: Set<string>;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  hasActiveFilters: boolean;
  onSortChange: (field: SavedSortField) => void;
  onSelectionChange: (next: Set<string>) => void;
  onRetry: () => void;
}) {
  // Anchor for shift-click range selection, matching the shared table's rule:
  // the range takes the state the anchor click was heading to.
  const anchorRef = useRef<{ id: string; selected: boolean } | null>(null);
  // The design carries row hover as a `style-hover` attribute its own renderer
  // understands; a screen may not add CSS, so one row at a time holds it here.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allSelected =
    rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const someSelected = rows.some((row) => selectedIds.has(row.id));

  const toggleAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    for (const row of rows) {
      if (checked) next.add(row.id);
      else next.delete(row.id);
    }
    anchorRef.current = null;
    onSelectionChange(next);
  };

  const toggleRow = (rowId: string, shiftKey: boolean) => {
    const next = new Set(selectedIds);
    const anchor = anchorRef.current;
    const anchorIndex = anchor
      ? rows.findIndex((row) => row.id === anchor.id)
      : -1;
    const currentIndex = rows.findIndex((row) => row.id === rowId);

    if (shiftKey && anchor && anchorIndex !== -1 && currentIndex !== -1) {
      const [from, to] =
        anchorIndex < currentIndex
          ? [anchorIndex, currentIndex]
          : [currentIndex, anchorIndex];
      for (let index = from; index <= to; index++) {
        const row = rows[index];
        if (!row) continue;
        if (anchor.selected) next.add(row.id);
        else next.delete(row.id);
      }
      anchorRef.current = { id: rowId, selected: anchor.selected };
      onSelectionChange(next);
      return;
    }

    const selecting = !next.has(rowId);
    if (selecting) next.add(rowId);
    else next.delete(rowId);
    anchorRef.current = { id: rowId, selected: selecting };
    onSelectionChange(next);
  };

  if (isLoading) return <TableSkeleton />;

  if (isError) {
    return (
      <div
        role="alert"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 12px",
          fontSize: 12.5,
          color: "var(--danger)",
        }}
      >
        <Icon name="i-alert" size={15} />
        <span style={{ flex: 1, minWidth: 0 }}>{errorMessage}</span>
        <SecondaryButton icon="i-refresh" onClick={onRetry}>
          Try again
        </SecondaryButton>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          padding: "28px 12px",
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--text-2)",
        }}
      >
        {hasActiveFilters
          ? "No saved keywords match the current filters."
          : "No saved keywords yet. Find and save keywords from Keyword Research."}
      </p>
    );
  }

  return (
    <div style={SCROLLER}>
      <table style={TABLE}>
        <thead>
          <tr style={HEAD_ROW}>
            <th scope="col" style={{ ...TH, width: 34 }}>
              {/* The label names the count, so a reader knows how many rows
                  the toggle is about to take. It reaches only this table's
                  rows: `toggleAll` walks `rows`, never a global selection. */}
              <Checkbox
                label={
                  allSelected
                    ? `Clear all ${rows.length} keywords on this page`
                    : `Select all ${rows.length} keywords on this page`
                }
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleAll}
              />
            </th>
            {SORTABLE_COLUMNS.map((column) => (
              <th
                key={column.id}
                scope="col"
                style={column.numeric ? TH_RIGHT : TH}
                aria-sort={
                  sort === column.id
                    ? order === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <SortButton
                  column={column}
                  active={sort === column.id}
                  order={order}
                  onClick={() => onSortChange(column.id)}
                />
              </th>
            ))}
            <th scope="col" style={TH}>
              Intent
            </th>
            <th scope="col" style={TH}>
              Lists
            </th>
            <th
              scope="col"
              style={TH_RIGHT}
              aria-sort={
                sort === "fetchedAt"
                  ? order === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <SortButton
                column={{
                  id: "fetchedAt",
                  label: "Last fetched",
                  numeric: true,
                }}
                active={sort === "fetchedAt"}
                order={order}
                onClick={() => onSortChange("fetchedAt")}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <SavedTableRow
              key={row.id}
              row={row}
              isLast={index === rows.length - 1}
              selected={selectedIds.has(row.id)}
              hovered={hoveredId === row.id}
              onHover={(hovered) => setHoveredId(hovered ? row.id : null)}
              onToggle={(shiftKey) => toggleRow(row.id, shiftKey)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortButton({
  column,
  active,
  order,
  onClick,
}: {
  column: Pick<SortableColumn, "id" | "label" | "numeric" | "help">;
  active: boolean;
  order: "asc" | "desc";
  onClick: () => void;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onClick}
      title={column.help}
      {...focusProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 4px",
        margin: "-2px -4px",
        border: "none",
        borderRadius: 5,
        background: "none",
        font: "inherit",
        color: active ? "var(--text)" : "inherit",
        cursor: "pointer",
        outline: "none",
        boxShadow: focusRing,
      }}
    >
      {column.label}
      {active ? (
        <Icon
          name={order === "asc" ? "i-arrow-up" : "i-arrow-down"}
          size={11}
        />
      ) : null}
      {column.help ? <span style={SR_ONLY}>{column.help}</span> : null}
    </button>
  );
}

function TableSkeleton() {
  const widths = [14, 170, 48, 40, 44, 26, 40, 96, 54];
  return (
    <div style={SCROLLER} aria-busy="true">
      <table style={TABLE}>
        <tbody>
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              style={{ borderBottom: rowIndex === 7 ? undefined : ROW_LINE }}
            >
              {Array.from({ length: COLUMN_COUNT }).map((__, cellIndex) => (
                <td key={cellIndex} style={TD}>
                  <SkeletonBar
                    width={widths[cellIndex] ?? 40}
                    alignRight={cellIndex > 1 && cellIndex !== 7}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
