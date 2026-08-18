import type { PerformanceRow } from "@/client/features/search-performance/SearchPerformanceTable";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  AppDataTable,
  useAppTable,
  useSelectionAnchor,
} from "@/client/components/table/AppDataTable";
import {
  TableBulkActionBar,
  TableBulkActionButton,
} from "@/client/components/table/TableBulkActionBar";
import { TablePagination } from "@/client/components/table/TablePagination";
import {
  buildStrikingColumns,
  type Report,
  type SearchPerformanceTableRow,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import {
  buildCsv,
  downloadCsv,
  normalizeExportValue,
  type CsvValue,
} from "@/client/lib/csv";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import { captureClientEvent } from "@/client/lib/posthog";
import {
  SEARCH_PERFORMANCE_PAGE_SIZES,
  type SearchPerformanceTableDimension,
} from "@/types/schemas/search-performance";
import { saveKeywords } from "@/serverFunctions/keywords";

type ExportTarget = "csv" | "sheets";

type ExportTable = { filename: string; headers: string[]; rows: CsvValue[][] };

function strikingExportTable(report: Report): ExportTable {
  const stamp = `${report.range.startDate}-to-${report.range.endDate}`;
  return {
    filename: `search-performance-striking-distance-${stamp}.csv`,
    headers: ["Query", "Page", "Impressions", "Clicks", "Position"],
    rows: report.strikingDistance.map((row) => [
      row.query,
      row.page,
      row.impressions,
      row.clicks,
      row.position,
    ]),
  };
}

function dimensionExportTable(
  dimension: SearchPerformanceTableDimension,
  rows: SearchPerformanceTableRow[],
  stamp: string,
): ExportTable {
  const isPage = dimension === "page";
  return {
    filename: `search-performance-${isPage ? "pages" : "queries"}-${stamp}.csv`,
    headers: [
      isPage ? "Page" : "Query",
      "Clicks",
      "Impressions",
      "CTR",
      "Position",
    ],
    rows: rows.map((row) => [
      row.key,
      row.clicks,
      row.impressions,
      row.ctr,
      row.position,
    ]),
  };
}

function runExport(table: ExportTable, target: ExportTarget): void {
  if (target === "csv") {
    downloadCsv(table.filename, buildCsv(table.headers, table.rows));
    captureClientEvent("data:export", {
      source_feature: "search_performance",
      result_count: table.rows.length,
    });
    return;
  }
  void exportTableToSheets({
    headers: table.headers,
    rows: table.rows,
    feature: "search_performance",
  });
}

function exportStriking(report: Report, target: ExportTarget): void {
  runExport(strikingExportTable(report), target);
}

/** Export the full queries/pages dataset (fetched separately, not the visible
 *  page) so pagination never truncates a download. */
function exportDimensionRows(
  dimension: SearchPerformanceTableDimension,
  rows: SearchPerformanceTableRow[],
  range: Report["range"],
  target: ExportTarget,
): void {
  const stamp = `${range.startDate}-to-${range.endDate}`;
  runExport(dimensionExportTable(dimension, rows, stamp), target);
}

/** The five tabs the Search Performance screen can export from. */
export type ExportTab =
  | "striking"
  | "queries"
  | "pages"
  | "countries"
  | "devices";

/**
 * Why export is unavailable right now, or null when it is fine.
 *
 * Returned as a sentence so the button's title says what to do rather than
 * just going grey.
 */
export function exportUnavailableReason(
  report: Report | null | undefined,
  tab: ExportTab,
  tableStatus: string,
  localRowCount: number,
): string | null {
  if (report == null) return "Connect Search Console to export.";
  if (tab === "striking") {
    return report.strikingDistance.length > 0
      ? null
      : "No striking-distance rows in this period.";
  }
  if (tab === "countries" || tab === "devices") {
    return localRowCount > 0 ? null : "No rows in this period.";
  }
  // queries and pages are fetched separately, so a failed table read is the
  // only thing that blocks them.
  if (tableStatus === "error") return "The table failed to load. Retry first.";
  if (tableStatus === "pending") return "Still loading this table.";
  return null;
}

/**
 * Export whatever the active tab is showing, as CSV.
 *
 * Queries and pages are re-fetched in full rather than exported from the
 * visible page, so pagination never silently truncates a download. Returns the
 * row count so the caller can report it.
 */
export async function exportCurrentTab(args: {
  tab: ExportTab;
  report: Report;
  localRows: PerformanceRow[];
  fetchTable: () => Promise<{
    rows: SearchPerformanceTableRow[];
    dimension: SearchPerformanceTableDimension;
  }>;
}): Promise<number> {
  const { tab, report, localRows, fetchTable } = args;

  if (tab === "striking") {
    exportStriking(report, "csv");
    return report.strikingDistance.length;
  }

  if (tab === "countries" || tab === "devices") {
    const stamp = `${report.range.startDate}-to-${report.range.endDate}`;
    runExport(
      {
        filename: `search-performance-${tab}-${stamp}.csv`,
        headers: ["Name", "Clicks", "Impressions", "CTR", "Position"],
        rows: localRows.map((row) => [
          row.key,
          row.clicks,
          row.impressions,
          row.ctr,
          row.position,
        ]),
      },
      "csv",
    );
    return localRows.length;
  }

  const table = await fetchTable();
  exportDimensionRows(table.dimension, table.rows, report.range, "csv");
  return table.rows.length;
}

export function StrikingDistanceTable({
  projectId,
  rows,
}: {
  projectId: string;
  rows: Report["strikingDistance"];
}) {
  const queryClient = useQueryClient();
  const anchorRef = useSelectionAnchor();
  const [rowSelection, setRowSelection] = useState({});
  const columns = useMemo(() => buildStrikingColumns(anchorRef), [anchorRef]);
  const table = useAppTable({
    data: rows,
    columns,
    withSorting: true,
    withPagination: true,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => `${row.query}::${row.page}`,
    initialState: {
      sorting: [{ id: "impressions", desc: true }],
      // All rows are already loaded; paginate client-side to keep the table
      // short. 50/page by default.
      pagination: { pageIndex: 0, pageSize: 50 },
    },
  });
  const pagination = table.getState().pagination;

  // Rows are query x page; saving/copying dedupes to the query strings.
  const selectedQueries = Array.from(
    new Set(table.getSelectedRowModel().rows.map((row) => row.original.query)),
  );

  const copyKeywords = async () => {
    try {
      // Sanitize against spreadsheet formula injection: GSC query strings are
      // untrusted and may begin with =, +, -, @, etc. See @/client/lib/csv.
      const text = selectedQueries
        .map((query) => normalizeExportValue(query))
        .join("\n");
      await navigator.clipboard.writeText(text);
      toast.success(
        `Copied ${selectedQueries.length} ${selectedQueries.length === 1 ? "keyword" : "keywords"}`,
      );
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const save = useMutation({
    mutationFn: (keywords: string[]) =>
      saveKeywords({ data: { projectId, keywords } }),
    onSuccess: (_result, keywords) => {
      captureClientEvent("keyword:save", {
        source_feature: "search_performance",
        keyword_count: keywords.length,
      });
      void queryClient.invalidateQueries({
        queryKey: ["savedKeywords", projectId],
      });
      toast.success(
        `Saved ${keywords.length} ${keywords.length === 1 ? "keyword" : "keywords"}`,
      );
      setRowSelection({});
    },
    onError: (error) => {
      toast.error(getStandardErrorMessage(error, "Could not save keywords"));
    },
  });

  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-base-content/60">
        No striking-distance queries in this period. These are queries ranking
        at positions 5 to 20, where an improvement is most likely to move
        traffic.
      </p>
    );
  }

  return (
    <>
      <div className="p-4">
        <p className="mb-3 text-sm text-base-content/60">
          Queries ranking at positions 5 to 20, sorted by impressions. Improve
          the listed page to move them into the top results.
        </p>
        <AppDataTable
          table={table}
          className="table table-zebra table-sm"
          wrapperClassName="overflow-x-auto"
        />
      </div>
      <TablePagination
        page={pagination.pageIndex + 1}
        pageSize={pagination.pageSize}
        pageSizes={SEARCH_PERFORMANCE_PAGE_SIZES}
        totalCount={rows.length}
        hasNextPage={table.getCanNextPage()}
        isLoading={false}
        onPageChange={(nextPage) => table.setPageIndex(nextPage - 1)}
        onPageSizeChange={(nextSize) => table.setPageSize(nextSize)}
      />
      <TableBulkActionBar
        selectedCount={selectedQueries.length}
        selectedLabel={selectedQueries.length === 1 ? "query" : "queries"}
        onClear={() => setRowSelection({})}
        actions={
          <div className="flex items-center gap-1 px-1.5">
            <TableBulkActionButton
              icon={<Copy className="size-3.5" />}
              onClick={() => void copyKeywords()}
            >
              Copy keywords
            </TableBulkActionButton>
            <TableBulkActionButton
              icon={
                save.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )
              }
              onClick={() => save.mutate(selectedQueries)}
              disabled={save.isPending}
            >
              Save as keywords
            </TableBulkActionButton>
          </div>
        }
      />
    </>
  );
}
