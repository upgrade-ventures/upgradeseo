import type { CSSProperties } from "react";

type Props = {
  page: number;
  pageSize: number;
  pageSizes: readonly number[];
  totalCount: number | null;
  hasNextPage: boolean;
  isLoading: boolean;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
};

function formatRange(
  page: number,
  pageSize: number,
  totalCount: number | null,
) {
  const start = (page - 1) * pageSize + 1;
  if (totalCount == null) {
    return `${start.toLocaleString()}–${(start + pageSize - 1).toLocaleString()}`;
  }
  if (totalCount === 0) return "0";
  const end = Math.min(totalCount, start + pageSize - 1);
  return `${start.toLocaleString()}–${end.toLocaleString()} of ${totalCount.toLocaleString()}`;
}

/** Previous/Next, in the design's two states: live, and the disabled variant. */
function pagerButton(disabled: boolean): CSSProperties {
  return {
    minHeight: 26,
    padding: "3px 9px",
    border: `1px solid ${disabled ? "var(--border-muted)" : "var(--line)"}`,
    background: "var(--surface)",
    color: disabled ? "var(--text-3)" : "var(--text)",
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  };
}

export function TablePagination({
  page,
  pageSize,
  pageSizes,
  totalCount,
  hasNextPage,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const totalPages =
    totalCount != null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  const canGoPrev = page > 1 && !isLoading;
  const canGoNext =
    (totalPages != null ? page < totalPages : hasNextPage) && !isLoading;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px var(--pad, 24px)",
        borderTop: "1px solid var(--line)",
        color: "var(--text-2)",
        fontSize: 12,
      }}
    >
      <span
        style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.01em" }}
        // The range changes under the reader when a page loads, and the count
        // is the only confirmation that the click did anything.
        aria-live="polite"
      >
        Showing {formatRange(page, pageSize, totalCount)}
        {isLoading ? " · loading…" : ""}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ whiteSpace: "nowrap" }}>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            style={{
              minHeight: 26,
              padding: "3px 6px",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--text)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <span
          style={{
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.01em",
          }}
        >
          Page {page.toLocaleString()}
          {totalPages != null ? ` of ${totalPages.toLocaleString()}` : ""}
        </span>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            aria-label="Previous page"
            className="prominence-pager-button"
            disabled={!canGoPrev}
            onClick={() => onPageChange(page - 1)}
            style={pagerButton(!canGoPrev)}
          >
            Previous
          </button>
          <button
            type="button"
            aria-label="Next page"
            className="prominence-pager-button"
            disabled={!canGoNext}
            onClick={() => onPageChange(page + 1)}
            style={pagerButton(!canGoNext)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
