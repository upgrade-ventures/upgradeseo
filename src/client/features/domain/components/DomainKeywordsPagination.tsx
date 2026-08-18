import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { focusRing } from "@/client/features/domain/components/domainTableStyles";
import { DOMAIN_KEYWORDS_PAGE_SIZES } from "@/types/schemas/domain";

type Props = {
  page: number;
  pageSize: number;
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
    return `${start.toLocaleString()}-${(start + pageSize - 1).toLocaleString()}`;
  }
  if (totalCount === 0) return "0";
  const end = Math.min(totalCount, start + pageSize - 1);
  return `${start.toLocaleString()}-${end.toLocaleString()} of ${totalCount.toLocaleString()}`;
}

export function DomainKeywordsPagination({
  page,
  pageSize,
  totalCount,
  hasNextPage,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const totalPages =
    totalCount != null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  const canGoPrev = page > 1;
  const canGoNext = totalPages != null ? page < totalPages : hasNextPage;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "9px var(--pad, 24px)",
        borderTop: "1px solid var(--line)",
        fontSize: 12,
        color: "var(--text-2)",
      }}
    >
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
        }}
        aria-live="polite"
      >
        {formatRange(page, pageSize, totalCount)}
        {isLoading ? " (updating)" : ""}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ whiteSpace: "nowrap" }}>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            style={{
              minHeight: 26,
              padding: "2px 6px",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--text)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              cursor: "pointer",
            }}
            {...focusRing<HTMLSelectElement>()}
          >
            {DOMAIN_KEYWORDS_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Page {page.toLocaleString()}
            {totalPages != null ? ` of ${totalPages.toLocaleString()}` : ""}
          </span>
          <PageLink
            page={page - 1}
            disabled={!canGoPrev || isLoading}
            onPageChange={onPageChange}
            label="Previous page"
          >
            <Icon
              name="i-chev-right"
              size={13}
              style={{ transform: "rotate(180deg)" }}
            />
          </PageLink>
          <PageLink
            page={page + 1}
            disabled={!canGoNext || isLoading}
            onPageChange={onPageChange}
            label="Next page"
          >
            <Icon name="i-chev-right" size={13} />
          </PageLink>
        </div>
      </div>
    </div>
  );
}

/**
 * Stays an anchor rather than a button: paging writes the URL, so the pager has
 * to keep working with a middle click or an open-in-new-tab.
 */
function PageLink({
  page,
  disabled,
  label,
  children,
  onPageChange,
}: {
  page: number;
  disabled: boolean;
  label: string;
  children: ReactNode;
  onPageChange: (nextPage: number) => void;
}) {
  return (
    <Link
      from="/p/$projectId/domain"
      to="/p/$projectId/domain"
      search={(prev) => ({
        ...prev,
        page: page === 1 ? undefined : page,
      })}
      aria-label={label}
      aria-disabled={disabled}
      className="prominence-button-secondary"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        minHeight: 26,
        padding: 0,
        color: "var(--text-2)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        onPageChange(page);
      }}
    >
      {children}
    </Link>
  );
}
