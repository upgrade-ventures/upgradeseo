import { BacklinksResults } from "./BacklinksPageSections";
import {
  BacklinksErrorState,
  BacklinksLoadingState,
} from "./BacklinksPageStates";
import { BacklinksHistorySection } from "./BacklinksHistorySection";
import type { AnchorSummary } from "./backlinksAnchors";
import type { BacklinksTableSort } from "./BacklinksDataTable";
import type { BacklinksSearchHistoryItem } from "@/client/hooks/useBacklinksSearchHistory";
import type {
  BacklinksOverviewData,
  BacklinksSearchState,
  BacklinksTabRows,
  BacklinksUiTab,
} from "./backlinksPageTypes";
import type { BacklinksDomainExpansion } from "./useBacklinksDomainExpansion";
import type { BacklinksFiltersState } from "./useBacklinksFilters";
import type { DomainRatings } from "./useAhrefsDomainRatings";
import type { CsvValue } from "@/client/lib/csv";
import type { BacklinksSortOrder } from "@/types/schemas/backlinks";
import {
  SearchTabStrip,
  type SearchTab,
} from "@/client/features/search-tabs/SearchTabStrip";

type BacklinksBodyProps = {
  projectId: string;
  history: BacklinksSearchHistoryItem[];
  historyLoaded: boolean;
  overviewData: BacklinksOverviewData | undefined;
  overviewError: string | null;
  overviewLoading: boolean;
  activeTab: BacklinksUiTab;
  tabRows: BacklinksTabRows;
  anchors: AnchorSummary;
  activeTabPage: { totalCount: number | null; hasMore: boolean } | undefined;
  searchState: BacklinksSearchState;
  filters: BacklinksFiltersState;
  sort: BacklinksTableSort;
  domainExpansion: BacklinksDomainExpansion;
  domainRatings: DomainRatings | null;
  isLoadingRatings: boolean;
  onLoadRatings: () => void;
  sheetsExport: { headers: string[]; rows: CsvValue[][]; feature: string };
  tabErrorMessage: string | null;
  tabLoading: boolean;
  tabFetching: boolean;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  onRemoveHistoryItem: (timestamp: number) => void;
  onRetryOverview: () => void;
  onSortChange: (field: string, order: BacklinksSortOrder) => void;
  onViewChange: (view: "all" | undefined) => void;
  searchTabs: {
    activeTabId: string | null;
    tabs: SearchTab[];
    onSelect: (tab: SearchTab) => void;
    onClose: (tabId: string) => void;
    onViewed: (tabId: string, when?: number) => void;
  } | null;
};

export function BacklinksBody({
  projectId,
  history,
  historyLoaded,
  overviewData,
  overviewError,
  overviewLoading,
  activeTab,
  tabRows,
  anchors,
  activeTabPage,
  searchState,
  filters,
  sort,
  domainExpansion,
  domainRatings,
  isLoadingRatings,
  onLoadRatings,
  sheetsExport,
  tabErrorMessage,
  tabLoading,
  tabFetching,
  onPageChange,
  onPageSizeChange,
  onRemoveHistoryItem,
  onRetryOverview,
  onSortChange,
  onViewChange,
  searchTabs,
}: BacklinksBodyProps) {
  const tabStrip = searchTabs ? (
    <SearchTabStrip
      projectId={projectId}
      activeTabId={searchTabs.activeTabId}
      tabs={searchTabs.tabs}
      onSelect={searchTabs.onSelect}
      onClose={searchTabs.onClose}
      onViewed={searchTabs.onViewed}
    />
  ) : null;

  if (!searchState.target) {
    return (
      <BacklinksHistorySection
        projectId={projectId}
        history={history}
        historyLoaded={historyLoaded}
        onRemoveHistoryItem={onRemoveHistoryItem}
      />
    );
  }

  if (overviewLoading) {
    return (
      <>
        {tabStrip}
        <BacklinksLoadingState />
      </>
    );
  }

  if (!overviewData) {
    return (
      <>
        {tabStrip}
        <BacklinksErrorState
          errorMessage={overviewError}
          onRetry={onRetryOverview}
        />
      </>
    );
  }

  return (
    <>
      {tabStrip}
      <BacklinksResults
        activeTab={activeTab}
        overviewData={overviewData}
        tabRows={tabRows}
        anchors={anchors}
        filters={filters}
        sort={sort}
        view={searchState.view}
        domainExpansion={domainExpansion}
        domainRatings={domainRatings}
        isLoadingRatings={isLoadingRatings}
        onLoadRatings={onLoadRatings}
        sheetsExport={sheetsExport}
        isTabLoading={tabLoading}
        tabErrorMessage={tabErrorMessage}
        pagination={{
          page: searchState.page,
          pageSize: searchState.pageSize,
          totalCount: activeTabPage?.totalCount ?? null,
          hasNextPage: activeTabPage?.hasMore ?? false,
          isFetching: tabFetching,
        }}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onSortChange={onSortChange}
        onViewChange={onViewChange}
      />
    </>
  );
}
