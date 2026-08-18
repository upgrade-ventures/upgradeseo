import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/client/components/icons/IconSprite";
import { DomainKeywordsPagination } from "@/client/features/domain/components/DomainKeywordsPagination";
import { DomainFilterPanel } from "@/client/features/domain/components/DomainFilterPanel";
import { DomainPagesTable } from "@/client/features/domain/components/DomainPagesTable";
import { NoticeStrip } from "@/client/features/domain/components/DomainNotices";
import { DomainTableTabSurface } from "@/client/features/domain/components/DomainTableTabSurface";
import {
  PAGE_FILTER_FIELDS,
  buildPagesClearSearchUpdate,
  buildPagesSearchUpdate,
  countPageFilterConditions,
} from "@/client/features/domain/domainFilterUtils";
import {
  debugDomain,
  useDomainRenderDebug,
} from "@/client/features/domain/domainDebug";
import { useDomainPagesQuery } from "@/client/features/domain/hooks/useDomainPagesQuery";
import { useDomainPageFilterPreferences } from "@/client/features/domain/useDomainFilterPreferences";
import {
  type DomainSortMode,
  type PageRow,
  type PagesFilterValues,
} from "@/client/features/domain/types";
import { pagesToTable } from "@/client/features/domain/utils";
import type { DomainOverviewRouteState } from "@/client/features/domain/domainRouteState";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import { captureClientEvent } from "@/client/lib/posthog";
import {
  MAX_FILTER_CONDITIONS,
  type DomainSearchParams,
} from "@/types/schemas/domain";

type SearchUpdate = Partial<DomainSearchParams>;

const EMPTY_PAGES_ROWS: PageRow[] = [];
const PAGE_TEXT_FILTERS = [
  {
    key: "include",
    label: "Include Page Terms",
    placeholder: "pricing, tools, guides",
  },
  {
    key: "exclude",
    label: "Exclude Page Terms",
    placeholder: "blog, tag, archive",
  },
] as const;
const PAGE_RANGE_FILTERS = [
  { title: "Traffic", minKey: "minTraffic", maxKey: "maxTraffic" },
  { title: "Keywords", minKey: "minVol", maxKey: "maxVol" },
] as const;

type Props = {
  projectId: string;
  domain: string;
  routeState: DomainOverviewRouteState;
  setSearchParams: (updates: SearchUpdate) => void;
  onSortClick: (sort: DomainSortMode) => void;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextSize: number) => void;
};

export function PagesTab({
  projectId,
  domain,
  routeState,
  setSearchParams,
  onSortClick,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const filterPreferences = useDomainPageFilterPreferences(
    `${projectId}:${domain}`,
  );
  const {
    filters: preferredFilters,
    save: savePreferredFilters,
    clear: clearPreferredFilters,
  } = filterPreferences;
  const appliedPagesFilters = useMemo(
    () =>
      routeState.hasAppliedPageFilters
        ? routeState.appliedPageFilters
        : preferredFilters,
    [
      preferredFilters,
      routeState.appliedPageFilters,
      routeState.hasAppliedPageFilters,
    ],
  );

  const query = useDomainPagesQuery({
    projectId,
    domain,
    includeSubdomains: routeState.subdomains,
    locationCode: routeState.sentLocationCode,
    page: routeState.page,
    pageSize: routeState.pageSize,
    sortMode: routeState.sort,
    sortOrder: routeState.order,
    appliedFilters: appliedPagesFilters,
    enabled: Boolean(domain),
  });

  const rows = query.data?.pages ?? EMPTY_PAGES_ROWS;
  // The E2E fixture payload has no `free` block, so the field is narrowed
  // rather than read off the union.
  const free = query.data && "free" in query.data ? query.data.free : undefined;
  const totalCount = query.data?.totalCount ?? null;
  const hasNextPage = query.data?.hasMore ?? false;
  const isLoading = query.isFetching;
  const showTableLoading = isLoading && (showFilters || rows.length === 0);
  useDomainRenderDebug("PagesTab", {
    showFilters,
    isLoading,
    isPending: query.isPending,
    rows: rows.length,
    totalCount,
    activeTab: routeState.tab,
    page: routeState.page,
    sort: routeState.sort,
    order: routeState.order,
  });

  const applyFilters = useCallback(
    (values: PagesFilterValues) => {
      if (countPageFilterConditions(values) > MAX_FILTER_CONDITIONS) return;
      const update = buildPagesSearchUpdate(values);
      debugDomain("PagesTab:apply-filters", { values, update });
      savePreferredFilters(values);
      setSearchParams(update);
    },
    [savePreferredFilters, setSearchParams],
  );

  const resetFilters = useCallback(() => {
    const update = buildPagesClearSearchUpdate();
    debugDomain("PagesTab:reset-filters", { update });
    clearPreferredFilters();
    setSearchParams(update);
  }, [clearPreferredFilters, setSearchParams]);

  const activeFilterCount = useMemo(
    () =>
      PAGE_FILTER_FIELDS.filter((k) => appliedPagesFilters[k].trim() !== "")
        .length,
    [appliedPagesFilters],
  );

  const exportTable = useMemo(() => pagesToTable(rows), [rows]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
    toast.success("Copied data");
  };
  const handleExportToSheets = () => {
    void exportTableToSheets({
      headers: exportTable.headers,
      rows: exportTable.rows,
      feature: "domain_overview",
    });
  };
  const handleDownload = (extension: "csv" | "xls") => {
    downloadCsv(
      `${domain}-pages.${extension}`,
      buildCsv(exportTable.headers, exportTable.rows),
    );
    if (extension === "csv") {
      captureClientEvent("data:export", {
        source_feature: "domain_overview",
        result_count: rows.length,
      });
    }
  };

  return (
    <>
      <DomainTableTabSurface
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        activeFilterCount={activeFilterCount}
        countLabel="pages"
        totalCount={totalCount}
        countIsFloor={free?.truncated ?? false}
        fallbackCount={rows.length}
        isLoading={isLoading}
        showTableLoading={showTableLoading}
        loadingColumns={4}
        notice={
          free ? (
            <NoticeStrip
              tone={free.unavailable.pages ? "warning" : "info"}
              title={
                free.unavailable.pages
                  ? "Page list unavailable"
                  : "Where these rows come from"
              }
            >
              {[
                free.unavailable.pages ?? free.source,
                free.unavailable.sort,
                free.unavailable.filters,
              ]
                .filter(Boolean)
                .join(" ")}
            </NoticeStrip>
          ) : null
        }
        exportActions={[
          {
            label: "Export to Sheets",
            icon: <Icon name="i-grid" size={14} />,
            onClick: handleExportToSheets,
          },
          {
            label: "Copy data (JSON)",
            icon: <Icon name="i-clipboard" size={14} />,
            onClick: handleCopy,
          },
          {
            label: "Download CSV",
            icon: <Icon name="i-download" size={14} />,
            onClick: () => handleDownload("csv"),
          },
          {
            label: "Download Excel",
            icon: <Icon name="i-layers" size={14} />,
            onClick: () => handleDownload("xls"),
          },
        ]}
        filterPanel={
          showFilters ? (
            <DomainFilterPanel
              debugName="PagesFilterPanel"
              activeFilterCount={activeFilterCount}
              appliedFilters={appliedPagesFilters}
              fields={PAGE_FILTER_FIELDS}
              textFields={PAGE_TEXT_FILTERS}
              rangeFields={PAGE_RANGE_FILTERS}
              countConditions={countPageFilterConditions}
              onApply={applyFilters}
              onClear={resetFilters}
            />
          ) : null
        }
        pagination={
          <DomainKeywordsPagination
            page={routeState.page}
            pageSize={routeState.pageSize}
            totalCount={totalCount}
            hasNextPage={hasNextPage}
            isLoading={isLoading}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        }
      >
        <DomainPagesTable
          rows={rows}
          sortMode={routeState.sort}
          currentSortOrder={routeState.order}
          unavailable={free?.unavailable}
          onSortClick={onSortClick}
        />
      </DomainTableTabSurface>
    </>
  );
}
