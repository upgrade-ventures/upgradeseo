import { useCallback, useMemo, useRef } from "react";
import { PageHeaderBand } from "@/client/components/prominence/Primitives";
import { Icon } from "@/client/components/icons/IconSprite";
import { useShellBreakpoint } from "@/client/layout/useShellBreakpoint";
import { useKeywordResearchController } from "@/client/features/keywords/state/useKeywordResearchController";
import type { KeywordResearchControllerInput } from "@/client/features/keywords/state/useKeywordResearchController";
import type { KeywordControlsValues } from "@/client/features/keywords/hooks/useKeywordControlsForm";
import { parseKeywordInput } from "@/client/features/keywords/state/keywordControllerActions";
import {
  useKeywordSearchParams,
  useResolvedKeywordLocation,
} from "@/client/features/keywords/state/keywordControllerInternals";
import type {
  KeywordSearchTabInput,
  SearchTab,
} from "@/client/features/search-tabs/types";
import { SearchTabStrip } from "@/client/features/search-tabs/SearchTabStrip";
import {
  tabInputKey,
  useSearchTabNavigation,
} from "@/client/features/search-tabs/useSearchTabNavigation";
import { KeywordResearchFilterPanel } from "./keywordResearchFilters";
import {
  HeaderActions,
  KeywordResearchContent,
  KeywordSaveConfirm,
  SourceNotes,
} from "./KeywordResearchScreenParts";
import { KeywordResearchSearchBar } from "./KeywordResearchSearchBar";
import { KeywordResearchSelectionBar } from "./KeywordResearchSelectionBar";
import { KeywordResearchViewsBar } from "./KeywordResearchViewsBar";
import { GhostButton } from "./prominenceControls";

type ControllerProps = Omit<KeywordResearchControllerInput, "onFormSubmit">;
type Props = Omit<
  ControllerProps,
  "locationCode" | "displayedLocationCode" | "setPreferredLocationCode"
> & { locationCode?: number };
type KeywordSearchTab = SearchTab & { input: KeywordSearchTabInput };

function isKeywordSearchTab(tab: SearchTab): tab is KeywordSearchTab {
  return tab.input.type === "keyword";
}

export function KeywordResearchPage(input: Props) {
  const setSearchParams = useKeywordSearchParams();
  const projectId = input.projectId;
  // The shell root spans the viewport, so the design's root-width breakpoints
  // resolve the same from window width, which is what the hook measures when
  // the ref is empty.
  const shellRef = useRef<HTMLElement>(null);
  const { mid, narrow } = useShellBreakpoint(shellRef);
  const { locationCode, displayedLocationCode, setPreferredLocationCode } =
    useResolvedKeywordLocation({
      projectId,
      locationCode: input.locationCode,
    });

  const navigateToKeywordInput = useCallback(
    (tabInput: KeywordSearchTabInput | null) => {
      if (!tabInput) {
        setSearchParams({
          q: undefined,
          loc: undefined,
          kLimit: undefined,
          mode: undefined,
          cs: undefined,
        });
        return;
      }

      setSearchParams({
        q: tabInput.keyword,
        loc: tabInput.locationCode,
        kLimit: tabInput.resultLimit === 150 ? undefined : tabInput.resultLimit,
        mode: tabInput.mode === "auto" ? undefined : tabInput.mode,
        cs: tabInput.clickstream ? true : undefined,
      });
    },
    [setSearchParams],
  );

  const urlInput = useMemo<KeywordSearchTabInput | null>(() => {
    const keywords = parseKeywordInput(input.keywordInput);
    const keyword = keywords[0];
    if (!keyword) return null;
    return {
      type: "keyword",
      keyword,
      locationCode,
      resultLimit: input.resultLimit,
      mode: input.keywordMode,
      clickstream: input.clickstream,
    };
  }, [
    input.clickstream,
    input.keywordInput,
    input.keywordMode,
    locationCode,
    input.resultLimit,
  ]);
  const searchTabs = useSearchTabNavigation({
    storageKey: `keyword:${projectId}`,
    urlInput,
    getLabel: useCallback(
      (tabInput) => (tabInput.type === "keyword" ? tabInput.keyword : ""),
      [],
    ),
    navigateToInput: useCallback(
      (tabInput) => {
        navigateToKeywordInput(tabInput?.type === "keyword" ? tabInput : null);
      },
      [navigateToKeywordInput],
    ),
  });

  const activeTab = useMemo<KeywordSearchTab | null>(() => {
    if (!urlInput) return null;
    const tab = searchTabs.tabs.find(
      (candidate) => candidate.id === searchTabs.activeTabId,
    );
    // activeTabId syncs in an effect, so it trails urlInput by a render; the
    // stale tab must not drive a query for a market the URL no longer names.
    return tab &&
      isKeywordSearchTab(tab) &&
      tabInputKey(tab.input) === tabInputKey(urlInput)
      ? tab
      : null;
  }, [searchTabs.activeTabId, searchTabs.tabs, urlInput]);

  const onFormSubmit = useCallback(
    (value: KeywordControlsValues) => {
      const keywords = parseKeywordInput(value.keyword);
      if (keywords.length === 0) return;

      const inputs: KeywordSearchTabInput[] = keywords.map((keyword) => ({
        type: "keyword",
        keyword,
        locationCode: value.locationCode,
        resultLimit: value.resultLimit,
        mode: value.mode,
        clickstream: value.clickstream,
      }));

      for (const tabInput of inputs) {
        searchTabs.openTab(tabInput);
      }
      navigateToKeywordInput(inputs.at(-1) ?? null);
    },
    [navigateToKeywordInput, searchTabs],
  );
  const showRecentSearches = useCallback(() => {
    searchTabs.setActiveTab(null);
    navigateToKeywordInput(null);
  }, [navigateToKeywordInput, searchTabs]);
  const controllerInput = useMemo<ControllerProps>(
    () =>
      activeTab
        ? {
            ...input,
            keywordInput: activeTab.input.keyword,
            locationCode: activeTab.input.locationCode,
            displayedLocationCode:
              activeTab.input.locationCode ?? displayedLocationCode,
            setPreferredLocationCode,
            resultLimit: activeTab.input.resultLimit,
            keywordMode: activeTab.input.mode,
            clickstream: activeTab.input.clickstream,
          }
        : {
            ...input,
            locationCode,
            displayedLocationCode,
            setPreferredLocationCode,
          },
    [
      activeTab,
      input,
      displayedLocationCode,
      locationCode,
      setPreferredLocationCode,
    ],
  );
  const controller = useKeywordResearchController({
    ...controllerInput,
    onFormSubmit,
  });

  // The triage bars belong to a result set. Before the first search there is
  // nothing to view, filter or select.
  const showTriage =
    controller.hasSearched &&
    controller.researchError === null &&
    (controller.isLoading || controller.rows.length > 0);

  return (
    <div
      style={{
        paddingBottom: 48,
        // The accessibility floor asks for 44px hit targets on mobile, while
        // the design's own control heights are 24-30px. Every control on this
        // screen floors its min-height against `--tap`, so the compact desktop
        // sizes survive and the narrow layout still clears 44px.
        ["--tap" as string]: narrow ? "44px" : "0px",
      }}
    >
      <PageHeaderBand
        title="Keyword Research"
        subtitle="Find what people search for, then save the ones worth writing about."
        actions={<HeaderActions controller={controller} />}
        tabs={
          <>
            <KeywordResearchSearchBar controller={controller} />
            {controller.hasSearched ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingBottom: 12,
                  flexWrap: "wrap",
                }}
              >
                <GhostButton
                  data-testid="keyword-research-recent-searches"
                  style={{ paddingLeft: 0 }}
                  onClick={showRecentSearches}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Icon
                      name="i-chev-right"
                      size={12}
                      style={{ transform: "rotate(180deg)" }}
                    />
                    Recent searches
                  </span>
                </GhostButton>
                {/* The strip scrolls its own tabs, so it must be allowed to
                    shrink rather than push the row wider than the band. */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SearchTabStrip
                    projectId={projectId}
                    tabs={searchTabs.tabs}
                    activeTabId={searchTabs.activeTabId}
                    onSelect={searchTabs.selectTab}
                    onClose={searchTabs.closeTab}
                    onViewed={searchTabs.markTabViewed}
                  />
                </div>
              </div>
            ) : null}
          </>
        }
      />

      {showTriage ? (
        <>
          <KeywordResearchViewsBar
            controller={controller}
            loading={controller.isLoading}
          />
          {controller.showFilters ? (
            <KeywordResearchFilterPanel controller={controller} />
          ) : null}
          <SourceNotes controller={controller} />
          <KeywordResearchSelectionBar
            controller={controller}
            projectId={projectId}
          />
        </>
      ) : null}

      {/* Confirmation sits above the table, where the selection it acts on is,
          rather than over it. */}
      <KeywordSaveConfirm controller={controller} />

      <KeywordResearchContent
        controller={controller}
        projectId={projectId}
        stacked={mid}
      />
    </div>
  );
}
