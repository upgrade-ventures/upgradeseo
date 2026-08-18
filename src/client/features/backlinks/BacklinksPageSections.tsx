import { AnchorsTable } from "./AnchorsTable";
import type { AnchorSummary } from "./backlinksAnchors";
import { ANCHOR_SAMPLE_SIZE } from "./backlinksAnchors";
import { BacklinksFilterPanel } from "./BacklinksFilterPanel";
import { BacklinksToolbar } from "./BacklinksControls";
import type { BacklinksTableSort } from "./BacklinksDataTable";
import {
  BacklinksStatStrip,
  BacklinksTrendPanels,
} from "./BacklinksOverviewPanels";
import { BACKLINKS_PANEL_ID } from "./BacklinksHeader";
import { BacklinksTabError } from "./BacklinksPageStates";
import { BacklinksTable } from "./BacklinksTable";
import { ReferringDomainsTable } from "./ReferringDomainsTable";
import { TopPagesTable } from "./TopPagesTable";
import type {
  BacklinksOverviewData,
  BacklinksTabRows,
  BacklinksUiTab,
} from "./backlinksPageTypes";
import type { BacklinksDomainExpansion } from "./useBacklinksDomainExpansion";
import type { BacklinksFiltersState } from "./useBacklinksFilters";
import type { DomainRatings } from "./useAhrefsDomainRatings";
import { InfoNote } from "@/client/components/prominence/Primitives";
import type { CsvValue } from "@/client/lib/csv";
import { TablePagination } from "@/client/components/table/TablePagination";
import {
  BACKLINKS_PAGE_SIZES,
  type BacklinksSortOrder,
} from "@/types/schemas/backlinks";

/**
 * What each tab's numbers are made of. Every table on this screen is built
 * from free sources with real gaps, and a reader who is not told where a
 * column comes from will read a blank as a zero.
 */
const TAB_NOTES: Record<BacklinksUiTab, string> = {
  domains:
    "Domains are grouped from the links Bing Webmaster Tools reports for this site, so the link counts are a floor rather than a site total. DR is an authority proxy from OpenPageRank, not a licensed link-index rank.",
  backlinks:
    "Individual links come from Bing Webmaster Tools, which reports them only for sites verified in your own Bing account. It does not report rel attributes, so follow status stays blank.",
  pages:
    "Pages and their inbound link counts come from Bing Webmaster Tools. It counts links per page and never the distinct domains behind them.",
  anchors:
    "Anchor text is counted on this device from the links Bing Webmaster Tools reports.",
};

function GutterNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "0 var(--pad, 24px)" }}>
      <InfoNote>{children}</InfoNote>
    </div>
  );
}

/** The design's bordered note, used once beneath the anchors table. */
function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        margin: "14px var(--pad, 24px)",
        padding: "9px 12px",
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--subtle)",
        fontSize: 12.5,
        color: "var(--text-2)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: "var(--info)",
          flexShrink: 0,
          marginTop: 5,
        }}
      />
      <span>{children}</span>
    </div>
  );
}

export function BacklinksResults({
  activeTab,
  overviewData,
  tabRows,
  anchors,
  filters,
  sort,
  view,
  domainExpansion,
  domainRatings,
  isLoadingRatings,
  onLoadRatings,
  sheetsExport,
  isTabLoading,
  tabErrorMessage,
  pagination,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onViewChange,
}: {
  activeTab: BacklinksUiTab;
  overviewData: BacklinksOverviewData;
  tabRows: BacklinksTabRows;
  anchors: AnchorSummary;
  filters: BacklinksFiltersState;
  sort: BacklinksTableSort;
  view: "all" | undefined;
  domainExpansion: BacklinksDomainExpansion;
  domainRatings: DomainRatings | null;
  isLoadingRatings: boolean;
  onLoadRatings: () => void;
  sheetsExport: { headers: string[]; rows: CsvValue[][]; feature: string };
  isTabLoading: boolean;
  tabErrorMessage: string | null;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number | null;
    hasNextPage: boolean;
    isFetching: boolean;
  };
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  onSortChange: (field: string, order: BacklinksSortOrder) => void;
  onViewChange: (view: "all" | undefined) => void;
}) {
  const showTable = !tabErrorMessage;

  return (
    <div id={BACKLINKS_PANEL_ID} role="tabpanel" tabIndex={-1}>
      {overviewData.scope === "page" ? (
        <InfoCallout>
          Showing links to this exact page. Enter a bare domain for site-wide
          results and the authority trend.
        </InfoCallout>
      ) : null}

      {activeTab === "domains" ? (
        <>
          <BacklinksStatStrip data={overviewData} />
          <BacklinksTrendPanels data={overviewData} />
        </>
      ) : null}

      <BacklinksToolbar
        activeTab={activeTab}
        filters={filters}
        view={view}
        onViewChange={onViewChange}
        domainRatingsLoaded={domainRatings !== null}
        isLoadingRatings={isLoadingRatings}
        onLoadRatings={onLoadRatings}
        sheetsExport={sheetsExport}
      />

      {filters.showFilters && activeTab !== "anchors" ? (
        <BacklinksFilterPanel
          activeTab={activeTab}
          filters={filters}
          onApplied={() => onPageChange(1)}
        />
      ) : null}

      {tabErrorMessage ? <BacklinksTabError message={tabErrorMessage} /> : null}

      {showTable && activeTab === "domains" ? (
        <ReferringDomainsTable
          rows={tabRows.referringDomains}
          domainRatings={domainRatings}
          sort={sort}
          onSortChange={onSortChange}
          loading={isTabLoading}
        />
      ) : null}
      {showTable && activeTab === "backlinks" ? (
        <BacklinksTable
          rows={tabRows.backlinks}
          domainRatings={domainRatings}
          sort={sort}
          onSortChange={onSortChange}
          expansion={view === "all" ? null : domainExpansion}
          loading={isTabLoading}
        />
      ) : null}
      {showTable && activeTab === "pages" ? (
        <TopPagesTable
          rows={tabRows.topPages}
          sort={sort}
          onSortChange={onSortChange}
          loading={isTabLoading}
        />
      ) : null}
      {showTable && activeTab === "anchors" ? (
        <AnchorsTable rows={anchors.rows} loading={isTabLoading} />
      ) : null}

      {activeTab === "anchors" ? (
        <>
          <InfoCallout>
            A healthy profile has variety. If one commercial anchor dominates,
            it usually means paid or templated links.
          </InfoCallout>
          <GutterNote>
            {TAB_NOTES.anchors} Share is a share of the{" "}
            {anchors.counted.toLocaleString()} counted{" "}
            {anchors.counted === 1 ? "link" : "links"}
            {anchors.withoutAnchor > 0
              ? `, excluding ${anchors.withoutAnchor.toLocaleString()} with no anchor text`
              : ""}
            , not of the whole profile. At most {ANCHOR_SAMPLE_SIZE} links are
            counted.
          </GutterNote>
        </>
      ) : (
        <>
          <GutterNote>{TAB_NOTES[activeTab]}</GutterNote>
          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            pageSizes={BACKLINKS_PAGE_SIZES}
            totalCount={pagination.totalCount}
            hasNextPage={pagination.hasNextPage}
            isLoading={pagination.isFetching}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
    </div>
  );
}
