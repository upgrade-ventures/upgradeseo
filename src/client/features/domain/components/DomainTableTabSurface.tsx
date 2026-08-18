import type { ReactNode } from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { TableExportMenu } from "@/client/components/table/TableBulkActionBar";
import { TableLoadingRows } from "@/client/features/domain/components/TableLoadingRows";

type DomainTableExportAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

type Props = {
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  countLabel: string;
  totalCount: number | null;
  /** True when the count is a floor, because the source capped its answer. */
  countIsFloor?: boolean;
  fallbackCount: number;
  exportActions: DomainTableExportAction[];
  filterPanel?: ReactNode;
  /** Provenance for the rows below, rendered above the toolbar. */
  notice?: ReactNode;
  isLoading: boolean;
  showTableLoading: boolean;
  loadingColumns?: number;
  children: ReactNode;
  pagination: ReactNode;
};

/**
 * The chrome around a table: filter toggle, row count, export, then the table
 * and its pager.
 *
 * The design gives this screen no toolbar at all, because the domain it draws
 * is static. Filtering, exporting and paging are real capabilities here, so
 * they keep working; they are restyled onto the design's row rules and gutters
 * so they read as part of the table rather than bolted above it.
 */
export function DomainTableTabSurface({
  showFilters,
  onToggleFilters,
  activeFilterCount,
  countLabel,
  totalCount,
  countIsFloor = false,
  fallbackCount,
  exportActions,
  filterPanel,
  notice,
  isLoading,
  showTableLoading,
  loadingColumns,
  children,
  pagination,
}: Props) {
  const count = totalCount ?? fallbackCount;

  return (
    <>
      {notice}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px var(--pad, 24px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <SecondaryButton
          icon="i-filter"
          onClick={onToggleFilters}
          aria-expanded={showFilters}
          aria-label="Toggle filters"
          style={
            showFilters
              ? {
                  background: "var(--inset)",
                  borderColor: "var(--border-strong)",
                }
              : undefined
          }
        >
          Filters
          {activeFilterCount > 0 ? (
            <span
              style={{
                marginLeft: 6,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
                color: "var(--accent)",
              }}
            >
              {activeFilterCount}
            </span>
          ) : null}
        </SecondaryButton>

        <span
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count.toLocaleString()}
          {countIsFloor ? "+" : ""} {countLabel}
        </span>

        <div style={{ flex: 1 }} />

        <TableExportMenu
          actions={exportActions}
          buttonClassName="prominence-button-secondary gap-1"
        />
      </div>

      {filterPanel}

      <div
        style={{
          opacity: isLoading && !showTableLoading ? 0.6 : 1,
          transition: "opacity 120ms ease",
        }}
      >
        {showTableLoading ? (
          <TableLoadingRows columns={loadingColumns} />
        ) : (
          children
        )}
      </div>

      {pagination}
    </>
  );
}
