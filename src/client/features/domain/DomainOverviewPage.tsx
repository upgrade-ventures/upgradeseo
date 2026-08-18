/* eslint-disable max-lines, max-lines-per-function -- Domain Overview keeps page-only orchestration colocated to avoid fake indirection. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DEFAULT_DOMAIN_KEYWORDS_PAGE_SIZE,
  type DomainSearchParams,
} from "@/types/schemas/domain";
import {
  LOCATIONS,
  isLabsLocationCode,
} from "@/client/features/keywords/locations";
import { useDomainSearchHistory } from "@/client/hooks/useDomainSearchHistory";
import type { DomainSearchHistoryItem } from "@/client/hooks/useDomainSearchHistory";
import {
  getDomainSearchChangeValidationErrors,
  getDomainSearchValidationErrors,
} from "@/client/features/domain/domainSearchValidation";
import { useDomainOverviewQuery } from "@/client/features/domain/hooks/useDomainOverviewQuery";
import { DomainOverviewLoadingState } from "@/client/features/domain/components/DomainOverviewLoadingState";
import { DomainHistorySection } from "@/client/features/domain/components/DomainHistorySection";
import { DomainHistoryTab } from "@/client/features/domain/components/DomainHistoryTab";
import { DomainMetricStrip } from "@/client/features/domain/components/DomainMetricStrip";
import { NoticeStrip } from "@/client/features/domain/components/DomainNotices";
import { DomainSearchCard } from "@/client/features/domain/components/DomainSearchCard";
import { KeywordsTab } from "@/client/features/domain/components/KeywordsTab";
import { PagesTab } from "@/client/features/domain/components/PagesTab";
import {
  PageHeaderBand,
  ScreenBody,
  SecondaryButton,
  StatusPill,
  Tab,
  TabStrip,
} from "@/client/components/prominence/Primitives";
import { getProjects } from "@/serverFunctions/projects";
import { SearchTabStrip } from "@/client/features/search-tabs/SearchTabStrip";
import type { SearchTabInput } from "@/client/features/search-tabs/types";
import { useSearchTabNavigation } from "@/client/features/search-tabs/useSearchTabNavigation";
import {
  getDefaultSortOrder,
  normalizeDomainTarget,
  toSortOrderSearchParam,
  toSortSearchParam,
} from "@/client/features/domain/utils";
import {
  createFormValidationErrors,
  shouldValidateFieldOnChange,
} from "@/client/lib/forms";
import { buildDomainFiltersClearSearchUpdate } from "@/client/features/domain/domainFilterUtils";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { captureClientEvent } from "@/client/lib/posthog";
import type { DomainOverviewRouteState } from "@/client/features/domain/domainRouteState";
import type {
  DomainActiveTab,
  DomainSortMode,
  SortOrder,
} from "@/client/features/domain/types";

type Props = {
  projectId: string;
  routeState: DomainOverviewRouteState;
  navigate: (args: {
    search: (prev: Record<string, unknown>) => Record<string, unknown>;
    replace: boolean;
  }) => void;
  onShowRecentSearches: () => void;
};

type DomainNavigate = Props["navigate"];
type DomainSearchUpdate = Partial<DomainSearchParams>;

const KEYWORDS_ONLY_SORTS: ReadonlySet<DomainSortMode> = new Set([
  "rank",
  "score",
  "cpc",
]);

function getSortSearchUpdate(
  nextSort: DomainSortMode,
  nextOrder: SortOrder,
): DomainSearchUpdate {
  return {
    sort: toSortSearchParam(nextSort),
    order: toSortOrderSearchParam(nextSort, nextOrder),
    page: undefined,
  };
}

function getLocationSearchUpdate(
  nextLocationCode: number,
  defaultLocationCode: number,
): DomainSearchUpdate {
  return {
    loc:
      nextLocationCode === defaultLocationCode ? undefined : nextLocationCode,
    page: undefined,
  };
}

function getPageSearchUpdate(nextPage: number): DomainSearchUpdate {
  const safe = Math.max(1, Math.floor(nextPage));
  return { page: safe === 1 ? undefined : safe };
}

function getPageSizeSearchUpdate(nextSize: number): DomainSearchUpdate {
  return {
    size: nextSize === DEFAULT_DOMAIN_KEYWORDS_PAGE_SIZE ? undefined : nextSize,
    page: undefined,
  };
}

function getTabSearchUpdate(
  nextTab: DomainActiveTab,
  currentSort: DomainSortMode,
): DomainSearchUpdate {
  if (nextTab === "keywords") {
    return { tab: undefined, page: undefined };
  }

  const fallbackSortNeeded = KEYWORDS_ONLY_SORTS.has(currentSort);
  const update: DomainSearchUpdate = {
    tab: "pages",
    page: undefined,
  };
  if (fallbackSortNeeded) {
    update.sort = "traffic";
    update.order = getDefaultSortOrder("traffic");
  }
  return update;
}

function getHistorySearchUpdate(
  item: DomainSearchHistoryItem,
  defaultLocationCode: number,
): DomainSearchUpdate {
  const historyLocation =
    item.locationCode != null && isLabsLocationCode(item.locationCode)
      ? item.locationCode
      : defaultLocationCode;

  return {
    ...buildDomainFiltersClearSearchUpdate(),
    domain: item.domain,
    subdomains: item.subdomains ? undefined : false,
    sort: toSortSearchParam(item.sort),
    order: undefined,
    tab: item.tab === "keywords" ? undefined : item.tab,
    loc: historyLocation === defaultLocationCode ? undefined : historyLocation,
    size: undefined,
  };
}

function getSearchSubmitUpdate({
  domain,
  subdomains,
  sort,
  locationCode,
  currentOrder,
  activeTab,
  defaultLocationCode,
}: {
  domain: string;
  subdomains: boolean;
  sort: DomainSortMode;
  locationCode: number;
  currentOrder: SortOrder;
  activeTab: DomainActiveTab;
  defaultLocationCode: number;
}): DomainSearchUpdate {
  return {
    ...buildDomainFiltersClearSearchUpdate(),
    domain,
    subdomains: subdomains ? undefined : false,
    sort: toSortSearchParam(sort),
    order: toSortOrderSearchParam(sort, currentOrder),
    tab: activeTab === "keywords" ? undefined : activeTab,
    loc: locationCode === defaultLocationCode ? undefined : locationCode,
    size: undefined,
  };
}

function useDomainOverviewState({
  navigate,
  routeState,
  projectId,
}: {
  navigate: DomainNavigate;
  routeState: DomainOverviewRouteState;
  projectId: string;
}) {
  const lastTrackedKey = useRef<string>("");

  const {
    history,
    isLoaded: historyLoaded,
    addSearch,
    removeHistoryItem,
  } = useDomainSearchHistory(projectId);

  const setSearchParams = useCallback(
    (updates: DomainSearchUpdate) => {
      navigate({
        search: (prev) => ({ ...prev, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );

  const applySort = useCallback(
    (nextSort: DomainSortMode, nextOrder: SortOrder) => {
      setSearchParams(getSortSearchUpdate(nextSort, nextOrder));
    },
    [setSearchParams],
  );

  const applyLocationChange = useCallback(
    (nextLocationCode: number) => {
      setSearchParams(
        getLocationSearchUpdate(
          nextLocationCode,
          routeState.defaultLocationCode,
        ),
      );
    },
    [routeState.defaultLocationCode, setSearchParams],
  );

  const handleSortColumnClick = useCallback(
    (nextSort: DomainSortMode) => {
      const nextOrder =
        nextSort === routeState.sort
          ? routeState.order === "asc"
            ? "desc"
            : "asc"
          : getDefaultSortOrder(nextSort);
      applySort(nextSort, nextOrder);
    },
    [applySort, routeState.order, routeState.sort],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      setSearchParams(getPageSearchUpdate(nextPage));
    },
    [setSearchParams],
  );

  const setPageSize = useCallback(
    (nextSize: number) => {
      setSearchParams(getPageSizeSearchUpdate(nextSize));
    },
    [setSearchParams],
  );

  const handleTabChange = useCallback(
    (nextTab: DomainActiveTab) => {
      setSearchParams(getTabSearchUpdate(nextTab, routeState.sort));
    },
    [routeState.sort, setSearchParams],
  );

  const handleHistorySelect = useCallback(
    (item: DomainSearchHistoryItem) => {
      setSearchParams(
        getHistorySearchUpdate(item, routeState.defaultLocationCode),
      );
    },
    [routeState.defaultLocationCode, setSearchParams],
  );

  const overviewQuery = useDomainOverviewQuery({
    projectId,
    domain: routeState.domain,
    includeSubdomains: routeState.subdomains,
    locationCode: routeState.sentLocationCode,
  });
  const overview = overviewQuery.data ?? null;
  const isLoading = routeState.domain.trim() !== "" && overviewQuery.isLoading;

  const controlsForm = useForm({
    defaultValues: {
      domain: routeState.domain,
      subdomains: routeState.subdomains,
      sort: routeState.sort,
      locationCode: routeState.locationCode,
    },
    validators: {
      onChange: ({ formApi, value }) =>
        getDomainSearchChangeValidationErrors(
          value,
          shouldValidateFieldOnChange(formApi, "domain"),
          formApi.state.submissionAttempts > 0,
        ),
      onSubmit: ({ value }) => getDomainSearchValidationErrors(value),
    },
    onSubmit: ({ formApi, value }) => {
      const target = normalizeDomainTarget(value.domain);
      if (!target) return;
      formApi.setFieldValue("domain", target);
      setSearchParams(
        getSearchSubmitUpdate({
          domain: target,
          subdomains: value.subdomains,
          sort: value.sort,
          locationCode: value.locationCode,
          currentOrder: routeState.order,
          activeTab: routeState.tab,
          defaultLocationCode: routeState.defaultLocationCode,
        }),
      );
    },
  });

  useEffect(() => {
    controlsForm.reset({
      domain: routeState.domain,
      subdomains: routeState.subdomains,
      sort: routeState.sort,
      locationCode: routeState.locationCode,
    });
  }, [
    controlsForm,
    routeState.domain,
    routeState.locationCode,
    routeState.sort,
    routeState.subdomains,
  ]);

  useEffect(() => {
    controlsForm.setErrorMap({
      onSubmit: overviewQuery.error
        ? createFormValidationErrors({
            form: getStandardErrorMessage(
              overviewQuery.error,
              "Lookup failed.",
            ),
          })
        : undefined,
    });
  }, [controlsForm, overviewQuery.error]);

  useEffect(() => {
    if (!overviewQuery.isSuccess || !overview) return;
    const key = `${routeState.domain}|${routeState.subdomains}|${routeState.locationCode}`;
    if (lastTrackedKey.current === key) return;
    lastTrackedKey.current = key;

    captureClientEvent("domain_overview:search_complete", {
      sort_mode: routeState.sort,
      include_subdomains: routeState.subdomains,
      result_count: overview.organicKeywords ?? 0,
      location_code: routeState.locationCode,
    });
    addSearch({
      domain: routeState.domain,
      subdomains: routeState.subdomains,
      sort: routeState.sort,
      tab: routeState.tab,
      locationCode: routeState.locationCode,
    });
    if (!overview.hasData) {
      toast.info("Not enough data for this domain");
    }
  }, [
    addSearch,
    overview,
    overviewQuery.isSuccess,
    routeState.domain,
    routeState.locationCode,
    routeState.sort,
    routeState.subdomains,
    routeState.tab,
  ]);

  useEffect(() => {
    if (routeState.domain.trim() !== "") return;
    lastTrackedKey.current = "";
  }, [routeState.domain]);

  const controlsLocationCode = useStore(
    controlsForm.store,
    (s) => s.values.locationCode,
  );
  const canSaveKeywords = useMemo(
    () =>
      controlsLocationCode === routeState.locationCode &&
      overview !== null &&
      overview.hasData,
    [controlsLocationCode, overview, routeState.locationCode],
  );

  const handleSearchSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void controlsForm.handleSubmit();
    },
    [controlsForm],
  );

  return {
    controlsForm,
    isLoading,
    overview,
    overviewError: overviewQuery.error,
    canSaveKeywords,
    history,
    historyLoaded,
    removeHistoryItem,
    setSearchParams,
    applyLocationChange,
    handleTabChange,
    handleSortColumnClick,
    handleHistorySelect,
    handleSearchSubmit,
    goToPage,
    setPageSize,
  };
}

export type DomainOverviewControlsForm = ReturnType<
  typeof useDomainOverviewState
>["controlsForm"];

/** The three views the design gives this screen. */
type DomainView = DomainActiveTab | "history";

const VIEW_LABEL: Record<DomainView, string> = {
  keywords: "Top keywords",
  pages: "Top pages",
  history: "History",
};

const VIEW_ORDER: DomainView[] = ["keywords", "pages", "history"];

const AS_OF_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

/** Bare host, so "example.com/blog" still matches the project's own domain. */
function toHost(value: string): string {
  return value.trim().toLowerCase().split("/")[0] ?? "";
}

/**
 * Arrow-key movement across the tab strip.
 *
 * The design wires no keyboard behaviour to its tabs, which leaves a
 * `role="tablist"` that does not behave like one. The handler lives on a
 * wrapper rather than inside the shared TabStrip primitive, which this screen
 * must not fork.
 */
const TAB_NAV_KEYS = ["ArrowLeft", "ArrowRight", "Home", "End"];

function moveTabFocus(event: React.KeyboardEvent<HTMLDivElement>) {
  if (!TAB_NAV_KEYS.includes(event.key)) return;
  const tabs = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ];
  const active = document.activeElement;
  const current = tabs.findIndex((tab) => tab === active);
  if (current === -1) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowLeft"
          ? (current - 1 + tabs.length) % tabs.length
          : (current + 1) % tabs.length;
  tabs[next]?.focus();
}

function TabKeyboardNav({ children }: { children: React.ReactNode }) {
  return <div onKeyDown={moveTabFocus}>{children}</div>;
}

export function DomainOverviewPage({
  projectId,
  routeState,
  navigate,
  onShowRecentSearches,
}: Props) {
  const routerNavigate = useNavigate();
  const state = useDomainOverviewState({
    navigate,
    routeState,
    projectId,
  });

  // History has no URL slot: the route's `tab` param is the data tab, and the
  // search schema is shared with the server functions. Keeping it local means
  // the keywords/pages choice still round-trips through the URL.
  const [historyOpen, setHistoryOpen] = useState(false);
  const activeView: DomainView = historyOpen ? "history" : routeState.tab;

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  const projectDomain =
    projectsQuery.data?.find((project) => project.id === projectId)?.domain ??
    null;

  const hasDomain = routeState.domain.trim() !== "";
  const isOwnSite =
    projectDomain != null &&
    toHost(projectDomain) === toHost(routeState.domain);

  const urlTabInput = useMemo<SearchTabInput | null>(() => {
    if (!hasDomain) return null;
    return {
      type: "domain",
      domain: routeState.domain,
      subdomains: routeState.subdomains,
      locationCode: routeState.sentLocationCode,
    };
  }, [
    hasDomain,
    routeState.domain,
    routeState.sentLocationCode,
    routeState.subdomains,
  ]);

  const navigateToSearchTab = useCallback(
    (input: SearchTabInput | null) => {
      if (input?.type !== "domain") {
        navigate({
          search: () => ({}),
          replace: true,
        });
        return;
      }

      navigate({
        search: (prev) => ({
          ...prev,
          ...buildDomainFiltersClearSearchUpdate(),
          domain: input.domain,
          subdomains: input.subdomains ? undefined : false,
          sort: undefined,
          order: undefined,
          tab: undefined,
          page: undefined,
          loc: input.locationCode,
          size: undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const searchTabs = useSearchTabNavigation({
    storageKey: `domain:${projectId}`,
    urlInput: urlTabInput,
    getLabel: useCallback(
      (input) => {
        if (input.type !== "domain") return "";
        const locationSuffix =
          input.locationCode == null ||
          input.locationCode === routeState.defaultLocationCode
            ? ""
            : ` ${LOCATIONS[input.locationCode] ?? input.locationCode}`;
        return `${input.domain}${locationSuffix}`;
      },
      [routeState.defaultLocationCode],
    ),
    navigateToInput: navigateToSearchTab,
  });

  const selectView = (view: DomainView) => {
    if (view === "history") {
      setHistoryOpen(true);
      return;
    }
    setHistoryOpen(false);
    state.handleTabChange(view);
  };

  const compareWithMySite = () => {
    if (projectDomain) {
      toast.success(`Comparing ${routeState.domain} with ${projectDomain}`);
    }
    void routerNavigate({
      to: "/p/$projectId/competitors",
      params: { projectId },
    });
  };

  const seeBacklinks = () => {
    // The backlinks screen takes a target, so the domain being inspected
    // carries over instead of silently switching to the user's own site.
    void routerNavigate({
      to: "/p/$projectId/backlinks",
      params: { projectId },
      search: { target: routeState.domain },
    });
  };

  const overview = state.overview;
  const subtitle = useMemo(() => {
    if (!hasDomain) {
      return "Look up any domain to see the keywords it targets and the pages it publishes.";
    }
    const parts: string[] = [];
    const country = LOCATIONS[routeState.locationCode];
    if (country) parts.push(country);
    parts.push(
      routeState.subdomains ? "including subdomains" : "root domain only",
    );
    if (overview?.fetchedAt) {
      parts.push(
        `data from ${new Date(overview.fetchedAt).toLocaleDateString(undefined, AS_OF_FORMAT)}`,
      );
    }
    return parts.join(" · ");
  }, [
    hasDomain,
    overview?.fetchedAt,
    routeState.locationCode,
    routeState.subdomains,
  ]);

  return (
    <div style={{ paddingBottom: 48 }}>
      <PageHeaderBand
        title={hasDomain ? routeState.domain : "Domain Overview"}
        badge={
          hasDomain && projectDomain ? (
            <StatusPill
              tone={isOwnSite ? "info" : "neutral"}
              icon={isOwnSite ? "i-globe" : "i-swords"}
            >
              {isOwnSite ? "Your site" : "External domain"}
            </StatusPill>
          ) : null
        }
        subtitle={subtitle}
        actions={
          hasDomain ? (
            <>
              <SecondaryButton icon="i-swords" onClick={compareWithMySite}>
                Compare with my site
              </SecondaryButton>
              <SecondaryButton icon="i-link" onClick={seeBacklinks}>
                See backlinks
              </SecondaryButton>
            </>
          ) : null
        }
        tabsFlush={false}
        tabs={
          <>
            <DomainSearchCard
              controlsForm={state.controlsForm}
              isLoading={state.isLoading}
              onSubmit={state.handleSearchSubmit}
              onLocationChange={state.applyLocationChange}
            />
            {hasDomain ? (
              <TabKeyboardNav>
                <TabStrip>
                  {VIEW_ORDER.map((view) => (
                    <Tab
                      key={view}
                      active={activeView === view}
                      controls={`domain-panel-${view}`}
                      onClick={() => selectView(view)}
                    >
                      {VIEW_LABEL[view]}
                    </Tab>
                  ))}
                </TabStrip>
              </TabKeyboardNav>
            ) : null}
          </>
        }
      />

      {hasDomain && searchTabs.tabs.length > 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "8px var(--pad, 24px)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <SecondaryButton
            icon="i-clock"
            onClick={() => {
              searchTabs.setActiveTab(null);
              onShowRecentSearches();
            }}
          >
            Recent lookups
          </SecondaryButton>
          <SearchTabStrip
            projectId={projectId}
            activeTabId={searchTabs.activeTabId}
            tabs={searchTabs.tabs}
            onSelect={searchTabs.selectTab}
            onClose={searchTabs.closeTab}
            onViewed={searchTabs.markTabViewed}
          />
        </div>
      ) : null}

      <DomainOverviewBody
        activeView={activeView}
        projectId={projectId}
        routeState={routeState}
        state={state}
      />
    </div>
  );
}

/**
 * Why the overview came back empty, in the user's terms.
 *
 * The server already distinguishes "the key is missing" from "the source has no
 * record of this domain" and puts the reason in `free.unavailable`. The banner
 * used to ignore that and always say "connect Google Ads and OpenPageRank",
 * which told someone who had just connected OpenPageRank to go and connect it
 * again. Reading the reasons back means an unscored domain and an unconfigured
 * key never render the same sentence.
 */
function emptyOverviewReason(
  reasons: Record<string, string> | undefined,
): string {
  const map = reasons ?? {};
  const shown = [
    map["openPageRankAuthority"],
    map["googleAdsTargetedKeywords"],
  ].filter((r): r is string => Boolean(r));
  if (shown.length === 0) {
    return "No connected free source returned data for it. Check the domain, or try it with subdomains included.";
  }
  return shown.join(" ");
}

function DomainOverviewBody({
  activeView,
  projectId,
  routeState,
  state,
}: {
  activeView: DomainView;
  projectId: string;
  routeState: DomainOverviewRouteState;
  state: ReturnType<typeof useDomainOverviewState>;
}) {
  if (routeState.domain.trim() === "") {
    return (
      <ScreenBody>
        <DomainHistorySection
          history={state.history}
          historyLoaded={state.historyLoaded}
          onRemoveHistoryItem={state.removeHistoryItem}
          onSelectHistoryItem={state.handleHistorySelect}
        />
      </ScreenBody>
    );
  }

  if (state.isLoading) {
    return (
      <DomainOverviewLoadingState
        showMetrics={activeView === "keywords"}
        columns={activeView === "pages" ? 4 : 7}
      />
    );
  }

  if (state.overviewError) {
    return (
      <NoticeStrip tone="danger" title="Lookup failed">
        {getStandardErrorMessage(
          state.overviewError,
          "The lookup did not complete. Try again in a moment.",
        )}
      </NoticeStrip>
    );
  }

  const overview = state.overview;
  if (!overview) {
    return (
      <ScreenBody>
        <DomainHistorySection
          history={state.history}
          historyLoaded={state.historyLoaded}
          onRemoveHistoryItem={state.removeHistoryItem}
          onSelectHistoryItem={state.handleHistorySelect}
        />
      </ScreenBody>
    );
  }

  if (activeView === "history") {
    return (
      <div role="tabpanel" id="domain-panel-history" aria-label="History">
        <DomainHistoryTab domain={overview.domain} />
      </div>
    );
  }

  if (activeView === "pages") {
    return (
      <div role="tabpanel" id="domain-panel-pages" aria-label="Top pages">
        <PagesTab
          key="pages"
          projectId={projectId}
          domain={overview.domain}
          routeState={routeState}
          setSearchParams={state.setSearchParams}
          onSortClick={state.handleSortColumnClick}
          onPageChange={state.goToPage}
          onPageSizeChange={state.setPageSize}
        />
      </div>
    );
  }

  return (
    <div role="tabpanel" id="domain-panel-keywords" aria-label="Top keywords">
      <DomainMetricStrip overview={overview} />
      {!overview.hasData ? (
        <NoticeStrip tone="warning" title="Nothing measurable for this domain">
          {emptyOverviewReason(
            "free" in overview ? overview.free?.unavailable : undefined,
          )}
        </NoticeStrip>
      ) : null}
      <KeywordsTab
        key="keywords"
        projectId={projectId}
        domain={overview.domain}
        routeState={routeState}
        canSaveKeywords={state.canSaveKeywords}
        setSearchParams={state.setSearchParams}
        onSortClick={state.handleSortColumnClick}
        onPageChange={state.goToPage}
        onPageSizeChange={state.setPageSize}
      />
    </div>
  );
}
