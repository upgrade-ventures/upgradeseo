import {
  Card,
  ScreenBody,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { TablePagination } from "@/client/components/table/TablePagination";
import type { Report } from "@/client/features/search-performance/SearchPerformanceColumns";
import { MetricStrip } from "@/client/features/search-performance/SearchPerformanceMetricStrip";
import {
  FootnoteCallout,
  PerformanceTable,
  type PerformanceRow,
  type TableStatus,
} from "@/client/features/search-performance/SearchPerformanceTable";
import { SEARCH_PERFORMANCE_PAGE_SIZES } from "@/types/schemas/search-performance";

/**
 * The four breakdown panels.
 *
 * Google reports no total row count for a dimension, so none of these claim
 * one; the pager states the window it is showing and nothing more.
 */

const EMPTY_MESSAGE =
  "No Search Console rows for this period. Google's data trails real time by two to three days.";

type PanelPagination = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  isLoading: boolean;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
};

type TableFeedback = {
  status: TableStatus;
  errorMessage: string;
  onRetry: () => void;
};

function Pager({ pagination }: { pagination: PanelPagination }) {
  return (
    <TablePagination
      page={pagination.page}
      pageSize={pagination.pageSize}
      pageSizes={SEARCH_PERFORMANCE_PAGE_SIZES}
      totalCount={null}
      hasNextPage={pagination.hasNextPage}
      isLoading={pagination.isLoading}
      onPageChange={pagination.onPageChange}
      onPageSizeChange={pagination.onPageSizeChange}
    />
  );
}

export function QueriesPanel({
  totals,
  prevTotals,
  comparisonTitle,
  rows,
  feedback,
  pagination,
}: {
  totals: Report["totals"];
  prevTotals: Report["prevTotals"];
  comparisonTitle: string;
  rows: PerformanceRow[];
  feedback: TableFeedback;
  pagination: PanelPagination;
}) {
  return (
    <>
      <MetricStrip
        totals={totals}
        prevTotals={prevTotals}
        comparisonTitle={comparisonTitle}
      />
      <ScreenBody>
        <Card
          title="Top queries"
          note={
            feedback.status === "ready" ? `showing ${rows.length}` : undefined
          }
        >
          <PerformanceTable
            variant="card"
            labelHeader="Query"
            rows={rows}
            status={feedback.status}
            errorMessage={feedback.errorMessage}
            onRetry={feedback.onRetry}
            emptyMessage={EMPTY_MESSAGE}
          />
          {feedback.status === "error" ? null : (
            <Pager pagination={pagination} />
          )}
        </Card>
      </ScreenBody>
    </>
  );
}

export function PagesPanel({
  rows,
  feedback,
  pagination,
}: {
  rows: PerformanceRow[];
  feedback: TableFeedback;
  pagination: PanelPagination;
}) {
  return (
    <>
      <PerformanceTable
        variant="bleed"
        labelHeader="Page"
        rows={rows}
        status={feedback.status}
        errorMessage={feedback.errorMessage}
        onRetry={feedback.onRetry}
        emptyMessage={EMPTY_MESSAGE}
      />
      {feedback.status === "error" ? null : <Pager pagination={pagination} />}
      <FootnoteCallout>
        Pages are grouped by canonical URL, so parameters and tracking tags do
        not split the numbers.
      </FootnoteCallout>
    </>
  );
}

export function CountriesPanel({ rows }: { rows: PerformanceRow[] }) {
  return (
    <>
      <PerformanceTable
        variant="bleed"
        labelHeader="Country"
        rows={rows}
        status="ready"
        emptyMessage={EMPTY_MESSAGE}
      />
      <FootnoteCallout>
        Search Console&apos;s top countries by clicks for this period, listed by
        ISO country code. Google returns no previous-period figure per country,
        so there is no change column here.
      </FootnoteCallout>
    </>
  );
}

export function DevicesPanel({
  rows,
  feedback,
}: {
  rows: PerformanceRow[];
  feedback: TableFeedback;
}) {
  const desktop = rows.find((row) => row.key === "Desktop");
  const mobile = rows.find((row) => row.key === "Mobile");
  // The design asserts mobile trails desktop. State it only when this property's
  // own numbers say so, and quote the gap they actually measured.
  const gap =
    desktop && mobile && desktop.impressions > 0 && mobile.impressions > 0
      ? mobile.position - desktop.position
      : null;

  return (
    <>
      <PerformanceTable
        variant="bleed"
        labelHeader="Device"
        rows={rows}
        status={feedback.status}
        errorMessage={feedback.errorMessage}
        onRetry={feedback.onRetry}
        emptyMessage={EMPTY_MESSAGE}
      />
      {gap != null && gap >= 1 ? (
        <FootnoteCallout>
          Mobile averages {gap.toFixed(1)} positions behind desktop in this
          period. A gap that size is usually layout, not content.
        </FootnoteCallout>
      ) : null}
    </>
  );
}

export function ReportError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "11px 12px",
        border: "1px solid var(--danger-border)",
        borderRadius: 8,
        background: "var(--danger-soft)",
        color: "var(--danger)",
        fontSize: 12.5,
      }}
    >
      <span>{message}</span>
      <SecondaryButton icon="i-refresh" onClick={onRetry}>
        Try again
      </SecondaryButton>
    </div>
  );
}
