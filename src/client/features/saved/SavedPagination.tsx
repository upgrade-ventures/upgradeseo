import { Icon } from "@/client/components/icons/IconSprite";
import { FIELD, useFocusRing } from "@/client/features/saved/savedParts";
import { SAVED_KEYWORD_PAGE_SIZES } from "@/client/features/saved-keywords/savedKeywordsUtils";

type PageSize = (typeof SAVED_KEYWORD_PAGE_SIZES)[number];

/** Footer strip of the results card: range, page size, and page steppers. */
export function SavedPagination({
  page,
  pageSize,
  totalCount,
  isFetching,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: PageSize;
  totalCount: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalCount, page * pageSize);
  const sizeRing = useFocusRing();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        padding: "8px 12px",
        borderTop: "1px solid var(--line)",
        background: "var(--subtle)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--text-2)",
          fontVariantNumeric: "tabular-nums",
        }}
        aria-live="polite"
      >
        {start.toLocaleString()}-{end.toLocaleString()} of{" "}
        {totalCount.toLocaleString()}
        {isFetching ? " · updating" : ""}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-2)",
          }}
        >
          Rows
          <select
            value={pageSize}
            onChange={(event) =>
              onPageSizeChange(parsePageSize(event.target.value))
            }
            {...sizeRing.focusProps}
            style={{ ...FIELD, boxShadow: sizeRing.focusRing }}
          >
            {SAVED_KEYWORD_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <span
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Page {page.toLocaleString()} of {totalPages.toLocaleString()}
        </span>

        <div style={{ display: "flex", gap: 6 }}>
          <StepButton
            label="Previous page"
            back
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          />
          <StepButton
            label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          />
        </div>
      </div>
    </div>
  );
}

function StepButton({
  label,
  back,
  disabled,
  onClick,
}: {
  label: string;
  back?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...focusProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--surface)",
        color: "var(--text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        outline: "none",
        boxShadow: focusRing,
      }}
    >
      <Icon
        name="i-chev-right"
        size={14}
        style={{ transform: back ? "rotate(180deg)" : undefined }}
      />
    </button>
  );
}

function parsePageSize(value: string): PageSize {
  const parsed = Number(value);
  return SAVED_KEYWORD_PAGE_SIZES.find((size) => size === parsed) ?? 50;
}
