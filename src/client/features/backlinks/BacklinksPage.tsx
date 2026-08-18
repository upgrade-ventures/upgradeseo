import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BacklinksHeader } from "./BacklinksHeader";
import { BacklinksSearchBand } from "./BacklinksSearchBand";
import { BacklinksBody } from "./BacklinksPageContent";
import type { BacklinksTableSort } from "./BacklinksDataTable";
import { buildAnchorSummary } from "./backlinksAnchors";
import { buildBacklinksTabExport, exportBacklinksTabCsv } from "./export";
import type {
  BacklinksPageProps,
  BacklinksSearchState,
  BacklinksTabRows,
  BacklinksUiTab,
} from "./backlinksPageTypes";
import { formatRelativeTimestamp } from "./backlinksPageUtils";
import {
  navigateToBacklinksSearch,
  useBacklinksPageData,
} from "./useBacklinksPageData";
import { useAhrefsDomainRatings } from "./useAhrefsDomainRatings";
import { useBacklinksDomainExpansion } from "./useBacklinksDomainExpansion";
import { useBacklinksFilters } from "./useBacklinksFilters";
import { useBacklinksSearchHistory } from "@/client/hooks/useBacklinksSearchHistory";
import type {
  BacklinksSearchTabInput,
  SearchTabInput,
} from "@/client/features/search-tabs/types";
import { useSearchTabNavigation } from "@/client/features/search-tabs/useSearchTabNavigation";
import {
  BACKLINKS_DEFAULT_SORT,
  DEFAULT_BACKLINKS_PAGE_SIZE,
  type BacklinksSortOrder,
} from "@/types/schemas/backlinks";

/** Unique domains the DR lookup can enrich, as each table renders them. */
function collectRatableDomains(tabRows: BacklinksTabRows): string[] {
  const domains = [
    ...tabRows.backlinks.map((row) => row.domainFrom?.replace(/^www\./, "")),
    ...tabRows.referringDomains.map((row) => row.domain),
  ];
  return [
    ...new Set(domains.filter((domain): domain is string => Boolean(domain))),
  ];
}

export function BacklinksPage({
  projectId,
  searchState,
  navigate,
}: BacklinksPageProps) {
  const filters = useBacklinksFilters();
  // The anchors tab is grouped on the client, so it is not one of the URL's
  // tab values; it overlays whichever server tab the URL still names.
  const [anchorsSelected, setAnchorsSelected] = useState(false);
  const activeTab: BacklinksUiTab = anchorsSelected
    ? "anchors"
    : searchState.tab;

  // Sort lives in the URL so sort changes and the page reset commit in one
  // navigation (no transient fetch of the old page with the new sort).
  const sort = useMemo<BacklinksTableSort>(() => {
    const fallback = BACKLINKS_DEFAULT_SORT[searchState.tab];
    return {
      field: searchState.sort ?? fallback.field,
      order: searchState.order ?? (searchState.sort ? "desc" : fallback.order),
    };
  }, [searchState.order, searchState.sort, searchState.tab]);

  const handleSortChange = useCallback(
    (field: string, order: BacklinksSortOrder) => {
      navigate({
        search: (prev) => ({ ...prev, sort: field, order, page: undefined }),
        replace: true,
      });
    },
    [navigate],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      navigate({
        search: (prev) => ({
          ...prev,
          page: nextPage === 1 ? undefined : nextPage,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const handlePageSizeChange = useCallback(
    (nextPageSize: number) => {
      navigate({
        search: (prev) => ({
          ...prev,
          size:
            nextPageSize === DEFAULT_BACKLINKS_PAGE_SIZE
              ? undefined
              : nextPageSize,
          page: undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleViewChange = useCallback(
    (nextView: "all" | undefined) => {
      navigate({
        search: (prev) => ({ ...prev, view: nextView, page: undefined }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleTabChange = useCallback(
    (tab: BacklinksUiTab) => {
      if (tab === "anchors") {
        setAnchorsSelected(true);
        return;
      }
      setAnchorsSelected(false);
      navigate({
        search: (prev) => ({
          ...prev,
          tab: tab === "domains" ? undefined : tab,
          page: undefined,
          sort: undefined,
          order: undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const domainExpansion = useBacklinksDomainExpansion({
    projectId,
    searchState,
  });

  const {
    activeTabErrorMessage,
    activeTabQuery,
    anchorsQuery,
    overviewErrorMessage,
    overviewQuery,
    referringDomainsQuery,
    rowsQuery,
    searchCardInitialValues,
    topPagesQuery,
  } = useBacklinksPageData({
    projectId,
    searchState,
    filters,
    activeTab,
  });

  const tabRows = useMemo<BacklinksTabRows>(
    () => ({
      backlinks: rowsQuery.data?.rows ?? [],
      referringDomains: referringDomainsQuery.data?.rows ?? [],
      topPages: topPagesQuery.data?.rows ?? [],
    }),
    [rowsQuery.data, referringDomainsQuery.data, topPagesQuery.data],
  );
  const anchors = useMemo(
    () => buildAnchorSummary(anchorsQuery.data?.rows ?? []),
    [anchorsQuery.data],
  );
  // The anchors tab groups a fixed sample on the client, so it has no page.
  const activeTabPage =
    activeTab === "backlinks"
      ? rowsQuery.data
      : activeTab === "domains"
        ? referringDomainsQuery.data
        : activeTab === "pages"
          ? topPagesQuery.data
          : undefined;

  const {
    ratings: domainRatings,
    isLoading: isLoadingRatings,
    loadRatings,
  } = useAhrefsDomainRatings(projectId);
  const ratableDomains = useMemo(
    () => collectRatableDomains(tabRows),
    [tabRows],
  );
  // Once the user has opted in, keep newly loaded domains enriched without a
  // re-click (e.g. after paging or switching tabs). KV-cached, so re-requesting
  // already-known domains is nearly free.
  useEffect(() => {
    if (!domainRatings) return;
    const missing = ratableDomains.filter(
      (domain) => !Object.hasOwn(domainRatings, domain),
    );
    if (missing.length > 0) void loadRatings(missing);
  }, [domainRatings, ratableDomains, loadRatings]);

  const exportTable = useMemo(
    () =>
      buildBacklinksTabExport({
        tab: activeTab,
        rows: tabRows,
        anchorRows: anchors.rows,
        domainRatings,
      }),
    [activeTab, anchors.rows, domainRatings, tabRows],
  );
  const exportTarget = overviewQuery.data?.displayTarget || searchState.target;

  const {
    history,
    isLoaded: historyLoaded,
    addSearch,
    removeHistoryItem,
  } = useBacklinksSearchHistory(projectId);
  const urlTabInput = useMemo<SearchTabInput | null>(() => {
    if (searchState.target.trim() === "") return null;
    return {
      type: "backlinks",
      target: searchState.target,
      scope: searchState.scope,
    };
  }, [searchState.scope, searchState.target]);
  const navigateToTab = useCallback(
    (input: SearchTabInput | null) => {
      if (input?.type !== "backlinks") {
        navigate({ search: () => ({}), replace: true });
        return;
      }
      navigateToBacklinksSearch(navigate, {
        target: input.target,
        scope: input.scope,
      });
    },
    [navigate],
  );
  const searchTabs = useSearchTabNavigation({
    storageKey: `backlinks:${projectId}`,
    urlInput: urlTabInput,
    getLabel: useCallback(
      (input) => (input.type === "backlinks" ? input.target : ""),
      [],
    ),
    navigateToInput: navigateToTab,
  });
  const toBacklinksTabInput = useCallback(
    (
      values: Pick<BacklinksSearchState, "target" | "scope">,
    ): BacklinksSearchTabInput => ({
      type: "backlinks",
      target: values.target,
      scope: values.scope,
    }),
    [],
  );

  const fetchedAt = overviewQuery.data?.fetchedAt;
  const handleRefresh = async () => {
    const [overviewResult] = await Promise.all([
      overviewQuery.refetch(),
      activeTabQuery.refetch(),
    ]);
    const nextFetchedAt = overviewResult.data?.fetchedAt;
    if (overviewResult.error) {
      toast.error("Could not refresh the backlink snapshot.");
      return;
    }
    if (!nextFetchedAt) return;
    if (nextFetchedAt === fetchedAt) {
      // The server holds each lookup for six hours, so a refetch inside that
      // window returns the same bytes. Saying so beats implying new data.
      toast.info(
        `Sources are cached for six hours. Still showing the snapshot from ${formatRelativeTimestamp(nextFetchedAt)}.`,
      );
      return;
    }
    toast.success("Backlink snapshot updated.");
  };

  const hasTarget = Boolean(searchState.target);

  return (
    <div style={{ paddingBottom: 48 }}>
      <BacklinksHeader
        title={exportTarget ? `Backlinks · ${exportTarget}` : "Backlinks"}
        target={exportTarget}
        scopeLabel={
          overviewQuery.data
            ? overviewQuery.data.scope === "domain"
              ? "Site-wide"
              : "Exact page"
            : null
        }
        subtitle={
          hasTarget
            ? fetchedAt
              ? `Snapshot from ${formatRelativeTimestamp(fetchedAt)} · sources refresh at most every six hours`
              : "Loading the link profile for this target."
            : "Look up who links to a site, which pages attract those links, and the anchor text they use."
        }
        search={
          <BacklinksSearchBand
            errorMessage={overviewErrorMessage}
            initialValues={searchCardInitialValues}
            onSubmit={(values) => {
              searchTabs.openTab(toBacklinksTabInput(values));
              navigateToBacklinksSearch(navigate, values);
              addSearch({ target: values.target, scope: values.scope });
            }}
          />
        }
        hasTarget={hasTarget}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        canExport={exportTable.rows.length > 0}
        onExportCsv={() =>
          exportBacklinksTabCsv({
            tab: activeTab,
            target: exportTarget,
            headers: exportTable.headers,
            rows: exportTable.rows,
          })
        }
        onRefresh={handleRefresh}
      />

      <BacklinksBody
        projectId={projectId}
        history={history}
        historyLoaded={historyLoaded}
        overviewData={overviewQuery.data}
        overviewError={overviewErrorMessage}
        overviewLoading={overviewQuery.isLoading}
        activeTab={activeTab}
        tabRows={tabRows}
        anchors={anchors}
        activeTabPage={activeTabPage}
        searchState={searchState}
        filters={filters}
        sort={sort}
        domainExpansion={domainExpansion}
        domainRatings={domainRatings}
        isLoadingRatings={isLoadingRatings}
        onLoadRatings={() => void loadRatings(ratableDomains)}
        sheetsExport={{
          headers: exportTable.headers,
          rows: exportTable.rows,
          feature: `backlinks_${activeTab}`,
        }}
        tabErrorMessage={activeTabErrorMessage}
        tabLoading={activeTabQuery.isLoading}
        tabFetching={activeTabQuery.isFetching}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onRemoveHistoryItem={removeHistoryItem}
        onRetryOverview={() => void overviewQuery.refetch()}
        onSortChange={handleSortChange}
        onViewChange={handleViewChange}
        searchTabs={
          searchState.target
            ? {
                activeTabId: searchTabs.activeTabId,
                tabs: searchTabs.tabs,
                onSelect: searchTabs.selectTab,
                onClose: searchTabs.closeTab,
                onViewed: searchTabs.markTabViewed,
              }
            : null
        }
      />
    </div>
  );
}
