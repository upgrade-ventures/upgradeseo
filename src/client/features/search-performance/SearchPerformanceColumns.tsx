import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { MutableRefObject } from "react";
import { makeSelectionColumn } from "@/client/components/table/AppDataTable";
import { SortableHeader } from "@/client/components/table/SortableHeader";
import type { SelectionAnchor } from "@/client/components/table/tableSelection";
import type {
  getSearchPerformanceReport,
  getSearchPerformanceTable,
} from "@/serverFunctions/searchPerformance";

export type SearchPerformanceTableRow = Extract<
  Awaited<ReturnType<typeof getSearchPerformanceTable>>,
  { connected: true }
>["rows"][number];

export type Report = Extract<
  Awaited<ReturnType<typeof getSearchPerformanceReport>>,
  { connected: true }
>;
type StrikingRow = Report["strikingDistance"][number];

const numberFormat = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return numberFormat.format(Math.round(value));
}

export function formatCtr(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatPosition(value: number): string {
  return value.toFixed(1);
}

const rightAligned = { numeric: true } as const;

const strikingHelper = createColumnHelper<StrikingRow>();

export function buildStrikingColumns(
  anchorRef: MutableRefObject<SelectionAnchor | null>,
): ColumnDef<StrikingRow>[] {
  return [
    makeSelectionColumn<StrikingRow>(anchorRef, {
      itemNoun: "query",
      // A striking-distance row is one query on one page, so the query alone
      // does not identify it: two rows can carry the same query text.
      describeRow: (row) => `${row.query} on ${row.page}`,
    }),
    strikingHelper.accessor("query", {
      enableSorting: false,
      header: () => "Query",
      cell: ({ getValue }) => (
        <span className="block max-w-xs truncate" title={getValue()}>
          {getValue()}
        </span>
      ),
    }),
    strikingHelper.accessor("page", {
      enableSorting: false,
      header: () => "Page",
      // GSC page keys are canonical http(s) URLs of the verified property;
      // the scheme check is defense-in-depth before rendering an href.
      cell: ({ getValue }) =>
        /^https?:\/\//.test(getValue()) ? (
          <a
            href={getValue()}
            target="_blank"
            rel="noreferrer"
            className="link link-hover block max-w-sm truncate"
            title={getValue()}
          >
            {getValue()}
          </a>
        ) : (
          <span className="block max-w-sm truncate" title={getValue()}>
            {getValue()}
          </span>
        ),
    }),
    strikingHelper.accessor("impressions", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Impressions" align="right" />
      ),
      cell: ({ getValue }) => formatCount(getValue()),
      meta: rightAligned,
    }),
    strikingHelper.accessor("clicks", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Clicks" align="right" />
      ),
      cell: ({ getValue }) => formatCount(getValue()),
      meta: rightAligned,
    }),
    strikingHelper.accessor("position", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Position" align="right" />
      ),
      cell: ({ getValue }) => formatPosition(getValue()),
      meta: rightAligned,
    }),
  ];
}
