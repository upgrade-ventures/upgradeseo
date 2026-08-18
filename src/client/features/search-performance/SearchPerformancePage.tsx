import { useEffect, useState } from "react";
import {
  keepPreviousData,
  queryOptions,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PageHeaderBand,
  ScreenBody,
  Tab,
  TabStrip,
} from "@/client/components/prominence/Primitives";
import { SearchConsoleConnectionCard } from "@/client/features/gsc/SearchConsoleConnectionCard";
import { SearchPerformanceLoadingState } from "@/client/features/search-performance/SearchPerformanceLoadingState";
import {
  CountriesPanel,
  DevicesPanel,
  PagesPanel,
  QueriesPanel,
  ReportError,
} from "@/client/features/search-performance/SearchPerformancePanels";
import {
  exportCurrentTab,
  exportUnavailableReason,
  StrikingDistanceTable,
  type ExportTab,
} from "@/client/features/search-performance/SearchPerformanceParts";
import type { PerformanceRow } from "@/client/features/search-performance/SearchPerformanceTable";
import {
  ALL,
  COMPARISON_LABELS,
  deviceLabel,
  RANGE_LABELS,
  SearchPerformanceToolbar,
} from "@/client/features/search-performance/SearchPerformanceToolbar";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { getGscConnection } from "@/serverFunctions/gsc";
import {
  exportSearchPerformanceTable,
  getSearchPerformanceReport,
  getSearchPerformanceTable,
} from "@/serverFunctions/searchPerformance";
import {
  GSC_DEVICES,
  SEARCH_PERFORMANCE_DEFAULT_PAGE_SIZE,
  type SearchPerformanceDateRange,
  type SearchPerformanceDevice,
  type SearchPerformanceTableDimension,
} from "@/types/schemas/search-performance";

/** The tab set is the export set, so it is declared once, next to the export. */
type TabId = ExportTab;

const TAB_LABELS: Record<TabId, string> = {
  queries: "Queries",
  pages: "Pages",
  countries: "Countries",
  devices: "Devices",
  striking: "Striking distance",
};
const TAB_ORDER: TabId[] = [
  "queries",
  "pages",
  "countries",
  "devices",
  "striking",
];

/** The verified property, as a hostname. GSC stores domain properties as
 *  `sc-domain:example.com` and URL-prefix properties as a full URL. */
function formatSiteLabel(siteUrl: string | null | undefined): string | null {
  if (!siteUrl) return null;
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length);
  }
  try {
    return new URL(siteUrl).host;
  } catch {
    return siteUrl;
  }
}

/** GSC page keys are absolute URLs on the verified property; the path alone is
 *  what distinguishes one row from the next. */
function pagePathLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** Click change against the previous period, or undefined when that period was
 *  never measured. Undefined renders as no delta, never as "0%". */
function clickDelta(
  clicks: number,
  previous: { clicks: number; impressions: number },
): PerformanceRow["delta"] {
  if (previous.impressions === 0 || previous.clicks === 0) return undefined;
  const change = ((clicks - previous.clicks) / previous.clicks) * 100;
  return {
    text: `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(0)}%`,
    tone: change >= 0 ? "success" : "danger",
  };
}

type FilterInput = {
  dateRange: SearchPerformanceDateRange;
  device?: SearchPerformanceDevice;
  country?: string;
};

// The server filter payload: drop device/country when set to the "ALL" sentinel.
function buildFilterInput(
  range: SearchPerformanceDateRange,
  device: SearchPerformanceDevice | typeof ALL,
  country: string,
): FilterInput {
  return {
    dateRange: range,
    ...(device === ALL ? {} : { device }),
    ...(country === ALL ? {} : { country }),
  };
}

// Single source for the paginated table query, shared by the live query and the
// warm-on-connect prefetch so their key + fn can never drift apart.
function tableQueryOptions(
  projectId: string,
  dimension: SearchPerformanceTableDimension,
  page: number,
  pageSize: number,
  filterInput: FilterInput,
) {
  return queryOptions({
    queryKey: [
      "searchPerformanceTable",
      projectId,
      dimension,
      page,
      pageSize,
      filterInput,
    ],
    queryFn: () =>
      getSearchPerformanceTable({
        data: { projectId, dimension, page, pageSize, ...filterInput },
      }),
  });
}

export function SearchPerformancePage({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [range, setRange] =
    useState<SearchPerformanceDateRange>("last_28_days");
  const [device, setDevice] = useState<SearchPerformanceDevice | typeof ALL>(
    ALL,
  );
  const [country, setCountry] = useState<string>(ALL);
  const [tab, setTab] = useState<TabId>("queries");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(
    SEARCH_PERFORMANCE_DEFAULT_PAGE_SIZE,
  );
  const [exporting, setExporting] = useState(false);

  // Any change to the query set (tab, filters, page size) restarts at page 1.
  useEffect(() => {
    setPage(1);
  }, [tab, range, device, country, pageSize]);

  const filterInput = buildFilterInput(range, device, country);

  // Shares its key with the connection card, so the property name is already
  // warm whenever the user has passed through settings.
  const connectionQuery = useQuery({
    queryKey: ["gscConnection", projectId],
    queryFn: () => getGscConnection({ data: { projectId } }),
  });
  const site = formatSiteLabel(connectionQuery.data?.siteUrl);

  const reportQuery = useQuery({
    queryKey: ["searchPerformance", projectId, range, device, country],
    queryFn: () =>
      getSearchPerformanceReport({ data: { projectId, ...filterInput } }),
    placeholderData: keepPreviousData,
  });
  const report = reportQuery.data?.connected ? reportQuery.data : null;

  const isTableTab = tab === "queries" || tab === "pages";
  const dimension: SearchPerformanceTableDimension =
    tab === "pages" ? "page" : "query";
  const tableQuery = useQuery({
    ...tableQueryOptions(projectId, dimension, page, pageSize, filterInput),
    enabled: report != null && isTableTab,
    placeholderData: keepPreviousData,
  });
  const tableRows = tableQuery.data?.connected ? tableQuery.data.rows : [];

  // The device breakdown is one filtered report per bucket: the overview server
  // function accepts a device filter but never returns the device dimension.
  // Only fetched while that tab is open, since each call is a full GSC report.
  const deviceQueries = useQueries({
    queries: GSC_DEVICES.map((value) => ({
      queryKey: ["searchPerformance", projectId, range, value, country],
      queryFn: () =>
        getSearchPerformanceReport({
          data: { projectId, ...buildFilterInput(range, value, country) },
        }),
      enabled: report != null && tab === "devices",
    })),
  });

  // Warm the Queries tab (first page) as soon as the report connects so the tab
  // opens instantly instead of showing a spinner. Free first-party GSC data.
  useEffect(() => {
    if (report == null) return;
    void queryClient.prefetchQuery(
      tableQueryOptions(
        projectId,
        "query",
        1,
        SEARCH_PERFORMANCE_DEFAULT_PAGE_SIZE,
        buildFilterInput(range, device, country),
      ),
    );
  }, [report, projectId, range, device, country, queryClient]);

  const dimensionRows: PerformanceRow[] = tableRows.map((row) => ({
    key: row.key,
    label: tab === "pages" ? pagePathLabel(row.key) : row.key,
    labelTitle: row.key,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
  const countryRows: PerformanceRow[] = (report?.countries ?? []).map(
    (row) => ({
      key: row.key.toUpperCase(),
      label: row.key.toUpperCase(),
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }),
  );
  const deviceRows: PerformanceRow[] = GSC_DEVICES.flatMap((value, index) => {
    const data = deviceQueries[index]?.data;
    if (!data?.connected) return [];
    return {
      key: deviceLabel(value),
      label: deviceLabel(value),
      clicks: data.totals.clicks,
      impressions: data.totals.impressions,
      ctr: data.totals.ctr,
      position: data.totals.position,
      delta: clickDelta(data.totals.clicks, data.prevTotals),
    };
  });

  const tableFeedback = {
    status: tableQuery.isError
      ? ("error" as const)
      : tableQuery.isPending
        ? ("loading" as const)
        : ("ready" as const),
    errorMessage: getStandardErrorMessage(tableQuery.error),
    onRetry: () => void tableQuery.refetch(),
  };
  const deviceFeedback = {
    status: deviceQueries.some((query) => query.isError)
      ? ("error" as const)
      : deviceQueries.some((query) => query.isPending)
        ? ("loading" as const)
        : ("ready" as const),
    errorMessage: getStandardErrorMessage(
      deviceQueries.find((query) => query.error)?.error,
    ),
    onRetry: () => {
      for (const query of deviceQueries) void query.refetch();
    },
  };

  const localRows = tab === "countries" ? countryRows : deviceRows;
  const exportReason = exportUnavailableReason(
    report,
    tab,
    tableFeedback.status,
    localRows.length,
  );

  const handleExport = async () => {
    if (report == null) return;
    setExporting(true);
    try {
      const rowCount = await exportCurrentTab({
        tab,
        report,
        localRows,
        fetchTable: () =>
          exportSearchPerformanceTable({
            data: { projectId, dimension, ...filterInput },
          }),
      });
      toast.success(
        `Exported ${rowCount} ${rowCount === 1 ? "row" : "rows"} to CSV`,
      );
    } catch (error) {
      toast.error(getStandardErrorMessage(error, "Export failed"));
    } finally {
      setExporting(false);
    }
  };

  const comparisonTitle = report
    ? `${report.range.startDate} to ${report.range.endDate}, compared with ${report.range.prevStartDate} to ${report.range.prevEndDate}`
    : "";
  const pagination = {
    page,
    pageSize,
    hasNextPage: tableQuery.data?.connected
      ? tableQuery.data.hasNextPage
      : false,
    isLoading: tableQuery.isFetching,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      <PageHeaderBand
        title="Search performance"
        subtitle={
          <>
            Straight from Google Search Console
            {site ? ` · ${site}` : ""} ·{" "}
            <span title={comparisonTitle || undefined}>
              {RANGE_LABELS[range].toLowerCase()} vs. {COMPARISON_LABELS[range]}
            </span>
          </>
        }
        actions={
          <SearchPerformanceToolbar
            projectId={projectId}
            connected={report != null}
            refreshing={reportQuery.isFetching && !reportQuery.isPending}
            range={range}
            onRangeChange={setRange}
            device={device}
            onDeviceChange={setDevice}
            deviceDisabled={tab === "devices"}
            country={country}
            onCountryChange={setCountry}
            countryDisabled={tab === "countries"}
            countryOptions={(report?.countries ?? []).map((row) => row.key)}
            exportReason={exportReason ?? undefined}
            exporting={exporting}
            onExport={() => void handleExport()}
          />
        }
        tabs={
          <TabStrip>
            {TAB_ORDER.map((id) => (
              <Tab
                key={id}
                active={tab === id}
                onClick={() => setTab(id)}
                // Only the open panel is mounted, so only the selected tab has
                // a live element to point at.
                controls={tab === id ? `gsc-panel-${id}` : undefined}
              >
                {id === "striking" && report
                  ? `Striking distance (${report.strikingDistance.length})`
                  : TAB_LABELS[id]}
              </Tab>
            ))}
          </TabStrip>
        }
      />

      {reportQuery.isPending ? (
        <SearchPerformanceLoadingState />
      ) : reportQuery.isError ? (
        <ScreenBody>
          <ReportError
            message={getStandardErrorMessage(reportQuery.error)}
            onRetry={() => void reportQuery.refetch()}
          />
        </ScreenBody>
      ) : report == null ? (
        <ScreenBody>
          <div style={{ maxWidth: 640 }}>
            <SearchConsoleConnectionCard projectId={projectId} />
          </div>
        </ScreenBody>
      ) : (
        <div
          role="tabpanel"
          id={`gsc-panel-${tab}`}
          aria-label={TAB_LABELS[tab]}
        >
          {tab === "queries" ? (
            <QueriesPanel
              totals={report.totals}
              prevTotals={report.prevTotals}
              comparisonTitle={comparisonTitle}
              rows={dimensionRows}
              feedback={tableFeedback}
              pagination={pagination}
            />
          ) : tab === "pages" ? (
            <PagesPanel
              rows={dimensionRows}
              feedback={tableFeedback}
              pagination={pagination}
            />
          ) : tab === "countries" ? (
            <CountriesPanel rows={countryRows} />
          ) : tab === "devices" ? (
            <DevicesPanel rows={deviceRows} feedback={deviceFeedback} />
          ) : (
            <StrikingDistanceTable
              projectId={projectId}
              rows={report.strikingDistance}
            />
          )}
        </div>
      )}
    </div>
  );
}
