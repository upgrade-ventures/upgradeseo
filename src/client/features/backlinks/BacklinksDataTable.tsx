import { useCallback, useState } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import type { BacklinksSortOrder } from "@/types/schemas/backlinks";

/**
 * The Prominence table used by all four backlinks tabs.
 *
 * The design gives every table the same shell and varies only the columns, so
 * the geometry (gutter-padded first cell, 12px inner cells, muted rules) is
 * written once here and driven by a column list.
 */

export type BacklinksCellVariant =
  /** First column: bold, left aligned, padded out to the page gutter. */
  | "name"
  /** Right-aligned figure at full text strength. */
  | "num"
  /** Right-aligned figure, muted. */
  | "numMuted"
  /** Left-aligned date with tabular figures. */
  | "date"
  /** Right-aligned muted text. */
  | "text"
  /** Left-aligned cell holding a pill or other block. */
  | "status";

export type BacklinksColumn<Row> = {
  key: string;
  header: string;
  variant: BacklinksCellVariant;
  /** Shown as the header's tooltip; also explains blanks in a column. */
  help?: string;
  /** Server sort field. Columns without one are not sortable. */
  sortField?: string;
  /** Order applied when this column is sorted for the first time. */
  sortDefault?: BacklinksSortOrder;
  render: (row: Row) => React.ReactNode;
};

export type BacklinksTableSort = {
  field: string;
  order: BacklinksSortOrder;
};

const HEAD_CELL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-3)",
};

function isRightAligned(variant: BacklinksCellVariant) {
  return variant === "num" || variant === "numMuted" || variant === "text";
}

function cellPadding(first: boolean, lastGutter: boolean) {
  if (first) return "var(--rp, 5px) var(--pad, 24px)";
  if (lastGutter) return "var(--rp, 5px) var(--pad, 24px) var(--rp, 5px) 12px";
  return "var(--rp, 5px) 12px";
}

function headPadding(first: boolean, lastGutter: boolean) {
  if (first) return "6px var(--pad, 24px)";
  if (lastGutter) return "6px var(--pad, 24px) 6px 12px";
  return "6px 12px";
}

function cellStyle(
  variant: BacklinksCellVariant,
  first: boolean,
  lastGutter: boolean,
): React.CSSProperties {
  const padding = cellPadding(first, lastGutter);
  const tabular = {
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.01em",
  } as const;

  switch (variant) {
    case "name":
      return { padding, textAlign: "left", fontWeight: 600 };
    case "num":
      return { padding, textAlign: "right", ...tabular };
    case "numMuted":
      return {
        padding,
        textAlign: "right",
        color: "var(--text-2)",
        ...tabular,
      };
    case "date":
      return { padding, color: "var(--text-2)", ...tabular };
    case "text":
      return { padding, textAlign: "right", color: "var(--text-2)" };
    case "status":
      return { padding };
  }
}

/**
 * A focus ring for the inline-styled controls in this feature.
 *
 * The design ships no focus styling and the shared sheet has no class for a
 * bare table control, so `:focus-visible` is matched here and the token is
 * applied inline. Matching the pseudo-class keeps the ring off mouse clicks.
 */
export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    setFocused(event.currentTarget.matches(":focus-visible"));
  }, []);
  const onBlur = useCallback(() => setFocused(false), []);
  return {
    focusProps: { onFocus, onBlur },
    focusStyle: focused
      ? ({ outline: "none", boxShadow: "var(--focus)" } as const)
      : null,
  };
}

function SortHeaderButton<Row>({
  column,
  sort,
  onSortChange,
}: {
  column: BacklinksColumn<Row>;
  sort: BacklinksTableSort | null;
  onSortChange: (field: string, order: BacklinksSortOrder) => void;
}) {
  const { focusProps, focusStyle } = useFocusRing();
  const field = column.sortField ?? "";
  const active = sort?.field === field;
  const order: BacklinksSortOrder = active
    ? sort.order
    : (column.sortDefault ?? "desc");

  return (
    <button
      type="button"
      title={column.help}
      onClick={() => onSortChange(field, active ? flipOrder(order) : order)}
      {...focusProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 0,
        border: "none",
        background: "none",
        font: "inherit",
        color: active ? "var(--text-2)" : "inherit",
        textTransform: "inherit",
        letterSpacing: "inherit",
        cursor: "pointer",
        borderRadius: 3,
        ...focusStyle,
      }}
    >
      {column.header}
      <Icon
        name={order === "asc" ? "i-arrow-up" : "i-arrow-down"}
        size={11}
        style={{ opacity: active ? 1 : 0.35 }}
      />
    </button>
  );
}

function flipOrder(order: BacklinksSortOrder): BacklinksSortOrder {
  return order === "asc" ? "desc" : "asc";
}

function ariaSort(
  column: { sortField?: string },
  sort: BacklinksTableSort | null,
): "ascending" | "descending" | "none" | undefined {
  if (!column.sortField) return undefined;
  if (sort?.field !== column.sortField) return "none";
  return sort.order === "asc" ? "ascending" : "descending";
}

function SkeletonBar({ align }: { align: "left" | "right" }) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        height: 9,
        width: "70%",
        marginLeft: align === "right" ? "auto" : undefined,
        borderRadius: 3,
        background: "var(--inset)",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

export function BacklinksDataTable<Row>({
  columns,
  rows,
  getRowKey,
  sort = null,
  onSortChange,
  /** The domains table pads its last cell out to the gutter; the others do not. */
  endGutter = false,
  loading = false,
  emptyLabel,
  caption,
  getRowStyle,
}: {
  columns: BacklinksColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
  sort?: BacklinksTableSort | null;
  onSortChange?: (field: string, order: BacklinksSortOrder) => void;
  endGutter?: boolean;
  loading?: boolean;
  emptyLabel: string;
  /** Screen-reader name for the table. */
  caption: string;
  getRowStyle?: (row: Row) => React.CSSProperties | undefined;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const lastIndex = columns.length - 1;

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
        <caption
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          {caption}
        </caption>
        <thead>
          <tr
            style={{
              background: "var(--subtle)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSort(column, sort)}
                title={column.sortField ? undefined : column.help}
                style={{
                  ...HEAD_CELL,
                  textAlign: isRightAligned(column.variant) ? "right" : "left",
                  padding: headPadding(
                    index === 0,
                    endGutter && index === lastIndex,
                  ),
                }}
              >
                {column.sortField && onSortChange ? (
                  <SortHeaderButton
                    column={column}
                    sort={sort}
                    onSortChange={onSortChange}
                  />
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <tr
                  key={`skeleton-${index}`}
                  style={{ borderBottom: "1px solid var(--border-muted)" }}
                >
                  {columns.map((column, cellIndex) => (
                    <td
                      key={column.key}
                      style={cellStyle(
                        column.variant,
                        cellIndex === 0,
                        endGutter && cellIndex === lastIndex,
                      )}
                    >
                      <SkeletonBar
                        align={
                          isRightAligned(column.variant) ? "right" : "left"
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {!loading && rows.length === 0 ? (
            <tr style={{ borderBottom: "1px solid var(--border-muted)" }}>
              <td
                colSpan={columns.length}
                style={{
                  padding: "26px var(--pad, 24px)",
                  textAlign: "center",
                  color: "var(--text-3)",
                }}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : null}
          {!loading &&
            rows.map((row, index) => {
              const key = getRowKey(row, index);
              return (
                <tr
                  key={key}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() =>
                    setHovered((current) => (current === key ? null : current))
                  }
                  style={{
                    borderBottom: "1px solid var(--border-muted)",
                    background: hovered === key ? "var(--subtle)" : undefined,
                    ...getRowStyle?.(row),
                  }}
                >
                  {columns.map((column, cellIndex) => (
                    <td
                      key={column.key}
                      style={cellStyle(
                        column.variant,
                        cellIndex === 0,
                        endGutter && cellIndex === lastIndex,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
