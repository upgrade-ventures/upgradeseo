import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Header,
  type Row,
  type Table,
  type TableOptions,
} from "@tanstack/react-table";
import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  BODY_ROW,
  DATA_TABLE,
  HEAD_ROW,
  ROW_HOVER,
  ROW_SELECTED,
  TABLE_SCROLL,
  TD,
  TH,
} from "./tableStyles";
import {
  applyShiftRangeSelection,
  type SelectionAnchor,
} from "./tableSelection";

type AppColumnMeta<TData> = {
  headerClassName?: string;
  cellClassName?: string | ((row: Row<TData>) => string | undefined);
  /** Right-aligned tabular column. Set on every column holding a figure. */
  numeric?: boolean;
};

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> extends AppColumnMeta<TData> {
    readonly __valueType?: TValue;
  }
}

type UseAppTableOptions<TData> = Omit<
  TableOptions<TData>,
  "getCoreRowModel"
> & {
  withSorting?: boolean;
  withExpanded?: boolean;
  withPagination?: boolean;
};

export function useAppTable<TData>(options: UseAppTableOptions<TData>) {
  const { withSorting, withExpanded, withPagination, ...tableOptions } =
    options;
  return useReactTable({
    ...tableOptions,
    getCoreRowModel: getCoreRowModel(),
    ...(withSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
    ...(withExpanded ? { getExpandedRowModel: getExpandedRowModel() } : {}),
    ...(withPagination
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
  });
}

export function useSelectionAnchor(): MutableRefObject<SelectionAnchor | null> {
  return useRef<SelectionAnchor | null>(null);
}

const CHECKBOX_STYLE: CSSProperties = {
  width: 13,
  height: 13,
  margin: 0,
  accentColor: "var(--accent)",
  cursor: "pointer",
};

/**
 * Selection column.
 *
 * Both labels are required rather than defaulted: "Select all rows" and "Select
 * row" tell a screen-reader user nothing about which table they are in or which
 * row they are on, and a default is how that wording survives. `describeRow`
 * names the row; `itemNoun` gives the header checkbox the count it is toggling.
 */
export function makeSelectionColumn<TData>(
  anchorRef: MutableRefObject<SelectionAnchor | null>,
  {
    describeRow,
    itemNoun,
  }: {
    describeRow: (row: TData) => string;
    /** Singular noun for the rows, e.g. "query". Pluralised with an "s". */
    itemNoun: string;
  },
): ColumnDef<TData> {
  return {
    id: "select",
    size: 32,
    enableSorting: false,
    header: ({ table }) => {
      // The count names the rows this toggle reaches, which is this table's
      // rows only: `getToggleAllRowsSelectedHandler` never leaves the table it
      // was built from.
      const count = table.getRowModel().rows.length;
      return (
        <input
          type="checkbox"
          style={CHECKBOX_STYLE}
          checked={table.getIsAllRowsSelected()}
          ref={(element) => {
            if (element) element.indeterminate = table.getIsSomeRowsSelected();
          }}
          onChange={table.getToggleAllRowsSelectedHandler()}
          aria-label={`Select all ${count} ${itemNoun}${count === 1 ? "" : "s"}`}
        />
      );
    },
    cell: ({ row, table }) => (
      <SelectionCheckbox
        row={row}
        table={table}
        anchorRef={anchorRef}
        label={`Select ${describeRow(row.original)}`}
      />
    ),
  };
}

function SelectionCheckbox<TData>({
  row,
  table,
  anchorRef,
  label,
}: {
  row: Row<TData>;
  table: Table<TData>;
  anchorRef: MutableRefObject<SelectionAnchor | null>;
  label: string;
}) {
  const rangeHandledRef = useRef(false);
  return (
    <input
      type="checkbox"
      style={CHECKBOX_STYLE}
      checked={row.getIsSelected()}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        rangeHandledRef.current = applyShiftRangeSelection(
          event,
          row,
          table,
          anchorRef,
        );
      }}
      onChange={(event) => {
        if (rangeHandledRef.current) {
          rangeHandledRef.current = false;
          return;
        }
        row.getToggleSelectedHandler()(event);
      }}
    />
  );
}

export function AppDataTable<TData>({
  table,
  className,
  wrapperClassName,
  wrapperStyle,
  empty,
  isLoading,
  loading,
  getRowClassName,
  getRowProps,
  getCellClassName,
  fixedLayout,
  stickyHeader,
}: {
  table: Table<TData>;
  className?: string;
  wrapperClassName?: string;
  /** Extra wrapper rules, e.g. a max height. Merged over the scroll box. */
  wrapperStyle?: CSSProperties;
  empty?: ReactNode;
  isLoading?: boolean;
  loading?: ReactNode;
  getRowClassName?: (row: Row<TData>) => string | undefined;
  getRowProps?: (row: Row<TData>) => {
    onClick?: (event: MouseEvent<HTMLTableRowElement>) => void;
    className?: string;
  };
  getCellClassName?: (row: Row<TData>, columnId: string) => string | undefined;
  fixedLayout?: boolean;
  stickyHeader?: boolean;
}) {
  // One hovered id rather than per-row state: the design carries row hover as a
  // style-hover attribute its own renderer understands, and a table may not add
  // rules to the shared stylesheet.
  const [hovered, setHovered] = useState<string | null>(null);

  if (isLoading && loading) return <>{loading}</>;
  if (table.getRowModel().rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div
      className={wrapperClassName}
      style={{ ...TABLE_SCROLL, ...wrapperStyle }}
    >
      <table
        className={className}
        style={{
          ...DATA_TABLE,
          ...(fixedLayout ? { tableLayout: "fixed" } : null),
        }}
      >
        {fixedLayout ? (
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} style={HEAD_ROW}>
              {headerGroup.headers.map((header) => (
                <HeaderCell
                  key={header.id}
                  header={header}
                  fixedLayout={fixedLayout}
                  stickyHeader={stickyHeader}
                />
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const rowProps = getRowProps?.(row);
            const selected = row.getIsSelected();
            return (
              <tr
                key={row.id}
                onClick={rowProps?.onClick}
                onMouseEnter={() => setHovered(row.id)}
                onMouseLeave={() =>
                  setHovered((current) => (current === row.id ? null : current))
                }
                className={[getRowClassName?.(row), rowProps?.className]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  ...BODY_ROW,
                  // Selection outranks hover: the accent bar is the row's state,
                  // the tint is only where the pointer happens to be.
                  ...(selected
                    ? ROW_SELECTED
                    : hovered === row.id
                      ? ROW_HOVER
                      : null),
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  const metaClass = meta?.cellClassName;
                  return (
                    <td
                      key={cell.id}
                      className={[
                        typeof metaClass === "function"
                          ? metaClass(row)
                          : metaClass,
                        getCellClassName?.(row, cell.column.id),
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        meta?.numeric
                          ? {
                              ...TD,
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                              letterSpacing: "0.01em",
                            }
                          : TD
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell<TData>({
  header,
  fixedLayout,
  stickyHeader,
}: {
  header: Header<TData, unknown>;
  fixedLayout?: boolean;
  stickyHeader?: boolean;
}) {
  const meta = header.column.columnDef.meta;
  return (
    <th
      className={meta?.headerClassName}
      style={{
        ...TH,
        ...(meta?.numeric ? { textAlign: "right" } : null),
        ...(fixedLayout ? { width: header.getSize() } : null),
        ...(stickyHeader
          ? {
              position: "sticky",
              top: 0,
              background: "var(--subtle)",
              zIndex: 1,
            }
          : null),
      }}
    >
      {header.isPlaceholder
        ? null
        : flexRender(header.column.columnDef.header, header.getContext())}
    </th>
  );
}
