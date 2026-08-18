import { useState, type ReactNode } from "react";

import {
  Card,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { Icon } from "@/client/components/icons/IconSprite";
import { SELECTION_BAND } from "@/client/components/table/tableStyles";
import { SavedBulkBar } from "@/client/features/saved/SavedBulkBar";
import { SavedFilterPanel } from "@/client/features/saved/SavedFilterPanel";
import { SavedPagination } from "@/client/features/saved/SavedPagination";
import {
  SavedTable,
  type SavedSortField,
} from "@/client/features/saved/SavedTable";
import type { SAVED_KEYWORD_PAGE_SIZES } from "@/client/features/saved-keywords/savedKeywordsUtils";
import type { useSavedKeywordsFilters } from "@/client/features/saved-keywords/useSavedKeywordsFilters";
import type { SavedKeywordRow } from "@/types/keywords";

type PageSize = (typeof SAVED_KEYWORD_PAGE_SIZES)[number];

/** The results card: refine controls, the table, and the paging footer. */
export function SavedResultsCard({
  rows,
  totalCount,
  page,
  pageSize,
  sort,
  order,
  selectedIds,
  filters,
  hasActiveFilters,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  removeError,
  bulk,
  onSortChange,
  onSelectionChange,
  onPageChange,
  onPageSizeChange,
  onClearAllFilters,
  onRetry,
}: {
  rows: SavedKeywordRow[];
  totalCount: number;
  page: number;
  pageSize: PageSize;
  sort: SavedSortField;
  order: "asc" | "desc";
  selectedIds: Set<string>;
  filters: ReturnType<typeof useSavedKeywordsFilters>;
  hasActiveFilters: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage: string;
  removeError: string | null;
  /** The selection band's own controls, rendered directly above the table. */
  bulk: {
    selectedCount: number;
    exportingSelection: "csv" | "sheets" | null;
    removing: boolean;
    confirmingRemove: boolean;
    /** The list panel, drawn in place under the band rather than as a modal. */
    listPanel: ReactNode;
    listPanelOpen: boolean;
    onCopy: () => void;
    onOpenTags: () => void;
    onExportCsv: () => void;
    onExportSheets: () => void;
    onAskRemove: () => void;
    onCancelRemove: () => void;
    onConfirmRemove: () => void;
    onClear: () => void;
  };
  onSortChange: (field: SavedSortField) => void;
  onSelectionChange: (next: Set<string>) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  onClearAllFilters: () => void;
  onRetry: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <Card
      title="Saved keywords"
      count={isLoading || isError ? undefined : totalCount.toLocaleString()}
      headerRight={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasActiveFilters ? (
            <SecondaryButton onClick={onClearAllFilters}>
              Clear filters
            </SecondaryButton>
          ) : null}
          <SecondaryButton
            icon="i-filter"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            aria-controls="saved-filter-panel"
          >
            Filters
            {filters.activeFilterCount > 0
              ? ` (${filters.activeFilterCount})`
              : ""}
          </SecondaryButton>
        </div>
      }
    >
      {showFilters ? (
        <div id="saved-filter-panel">
          <SavedFilterPanel
            form={filters.filtersForm}
            activeFilterCount={filters.activeFilterCount}
            onReset={onClearAllFilters}
          />
        </div>
      ) : null}

      {removeError ? (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            margin: "12px 12px 0",
            padding: "9px 12px",
            border: "1px solid var(--danger-border)",
            borderRadius: 8,
            background: "var(--danger-soft)",
            color: "var(--danger)",
            fontSize: 12.5,
          }}
        >
          <Icon
            name="i-alert"
            size={14}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <span>{removeError}</span>
        </div>
      ) : null}

      {/* The design puts the selection band directly above the table it
          describes, not floating over the page. */}
      {bulk.confirmingRemove ? (
        <RemoveConfirmBand
          selectedCount={bulk.selectedCount}
          removing={bulk.removing}
          onCancel={bulk.onCancelRemove}
          onConfirm={bulk.onConfirmRemove}
        />
      ) : (
        <SavedBulkBar
          selectedCount={bulk.selectedCount}
          exportingSelection={bulk.exportingSelection}
          onCopy={bulk.onCopy}
          onOpenTags={bulk.onOpenTags}
          onExportCsv={bulk.onExportCsv}
          onExportSheets={bulk.onExportSheets}
          onDelete={bulk.onAskRemove}
          onClear={bulk.onClear}
          listPanelOpen={bulk.listPanelOpen}
        />
      )}
      {bulk.listPanel}

      <SavedTable
        rows={rows}
        sort={sort}
        order={order}
        selectedIds={selectedIds}
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        hasActiveFilters={hasActiveFilters}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
        onRetry={onRetry}
      />

      {isError ? null : (
        <SavedPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          isFetching={isFetching}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </Card>
  );
}

/**
 * The second step of a removal, drawn in the band the request came from.
 *
 * The design has no modal surface anywhere, so a destructive confirmation
 * replaces the actions it belongs to rather than covering the page. It names
 * the count and says what is lost, and Cancel is the first control a keyboard
 * user reaches.
 */
function RemoveConfirmBand({
  selectedCount,
  removing,
  onCancel,
  onConfirm,
}: {
  selectedCount: number;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const plural = selectedCount === 1 ? "" : "s";
  return (
    <div
      role="group"
      aria-live="polite"
      style={{
        ...SELECTION_BAND,
        background: "var(--danger-soft)",
        borderBottom: "1px solid var(--danger-border)",
      }}
    >
      <Icon
        name="i-alert"
        size={15}
        style={{ color: "var(--danger)", flexShrink: 0 }}
      />
      <span style={{ fontSize: 12.5, color: "var(--text)" }}>
        Remove {selectedCount.toLocaleString()} saved keyword{plural}? The
        keyword{plural} and {selectedCount === 1 ? "its" : "their"} list
        membership go for good. Nothing else changes, and you can save{" "}
        {selectedCount === 1 ? "it" : "them"} again from Keyword Research.
      </span>
      <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="prominence-button-secondary max-sm:min-h-11"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={removing}
          className="prominence-button-secondary max-sm:min-h-11"
          style={{
            borderColor: "var(--danger-border)",
            background: "var(--surface)",
            color: "var(--danger)",
            fontWeight: 600,
          }}
        >
          {removing ? "Removing…" : `Remove ${selectedCount.toLocaleString()}`}
        </button>
      </div>
    </div>
  );
}
