import { useMemo, useState } from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import {
  buildBrandLookupExport,
  downloadBrandLookupCsv,
} from "@/client/features/ai-search/components/brandLookupExport";
import { BrandLookupFilterPanel } from "@/client/features/ai-search/components/BrandLookupFilterPanel";
import {
  sortByNumber,
  type SortState,
} from "@/client/features/ai-search/components/aiTableParts";
import { BrandLookupPagesTable } from "@/client/features/ai-search/components/BrandLookupPagesTable";
import { BrandLookupQueriesTable } from "@/client/features/ai-search/components/BrandLookupQueriesTable";
import { Chip } from "@/client/features/ai-search/components/aiControls";
import { formatPlatformLabel } from "@/client/features/ai-search/platformLabels";
import {
  filterQueries,
  filterTopPages,
} from "@/client/features/ai-search/brandLookupFiltering";
import { useBrandLookupFilters } from "@/client/features/ai-search/useBrandLookupFilters";
import type { CitationTab } from "@/client/features/ai-search/brandLookupFilterTypes";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

/**
 * The sampled-prompt table of the design, plus the cited-source table the
 * design never draws but the data carries. Both sit full-bleed under the stat
 * strip with one toolbar row above them, so the tables keep the page gutter
 * instead of being indented inside a card.
 */
export function CitationTabsCard({
  result,
  projectId,
}: {
  result: BrandLookupResult;
  projectId: string;
}) {
  const [activeTab, setActiveTab] = useState<CitationTab>("queries");
  const [queriesSort, setQueriesSort] = useState<SortState>({ desc: true });
  const [pagesSort, setPagesSort] = useState<SortState>({ desc: true });
  const filters = useBrandLookupFilters();

  // The model column only earns its place when a tab actually spans more than
  // one surface; otherwise it repeats one value on every row and the caption
  // below the table says it once instead.
  const queryPlatforms = [
    ...new Set(result.topQueries.map((query) => query.platform)),
  ];
  const pagePlatforms = [
    ...new Set(result.topPages.map((page) => page.platform)),
  ];
  const targetDomain =
    result.detectedTargetType === "domain" ? result.resolvedTarget : null;

  const sortedQueries = useMemo(
    () =>
      sortByNumber(
        filterQueries(result.topQueries, filters.queries.values),
        (row) => row.aiSearchVolume,
        queriesSort.desc,
      ),
    [result.topQueries, filters.queries.values, queriesSort.desc],
  );
  const sortedPages = useMemo(
    () =>
      sortByNumber(
        filterTopPages(result.topPages, filters.pages.values),
        (row) => row.capturedVolume,
        pagesSort.desc,
      ),
    [result.topPages, filters.pages.values, pagesSort.desc],
  );

  const exportTable = buildBrandLookupExport(
    activeTab,
    sortedPages,
    sortedQueries,
  );
  const canExport = exportTable.rows.length > 0;

  const activePlatforms =
    activeTab === "pages" ? pagePlatforms : queryPlatforms;
  const captionPlatform =
    activePlatforms.length === 1 ? activePlatforms[0] : null;
  const filterCount = filters[activeTab].activeFilterCount;

  return (
    <section aria-label="Sampled prompts and cited sources">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          padding: "8px var(--pad, 24px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          role="group"
          aria-label="Table"
          style={{ display: "flex", gap: 6 }}
        >
          <Chip
            active={activeTab === "queries"}
            onClick={() => setActiveTab("queries")}
          >
            Sampled prompts
          </Chip>
          <Chip
            active={activeTab === "pages"}
            onClick={() => setActiveTab("pages")}
          >
            Cited sources
          </Chip>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SecondaryButton
            icon="i-filter"
            aria-expanded={filters.showFilters}
            onClick={() => filters.setShowFilters((current) => !current)}
          >
            {filterCount > 0 ? `Filters (${filterCount})` : "Filters"}
          </SecondaryButton>
          <SecondaryButton
            icon="i-download"
            disabled={!canExport}
            onClick={() =>
              downloadBrandLookupCsv(
                activeTab,
                result.resolvedTarget,
                exportTable,
              )
            }
          >
            Export CSV
          </SecondaryButton>
          <SecondaryButton
            icon="i-external"
            disabled={!canExport}
            onClick={() =>
              void exportTableToSheets({
                headers: exportTable.headers,
                rows: exportTable.rows,
                feature: `brand_lookup_${activeTab}`,
              })
            }
          >
            Export to Sheets
          </SecondaryButton>
        </div>
      </div>

      {filters.showFilters ? (
        <BrandLookupFilterPanel activeTab={activeTab} filters={filters} />
      ) : null}

      {activeTab === "queries" ? (
        <BrandLookupQueriesTable
          rows={sortedQueries}
          resolvedTarget={result.resolvedTarget}
          projectId={projectId}
          showPlatform={queryPlatforms.length > 1}
          sort={queriesSort}
          onSortChange={setQueriesSort}
          emptyMessage={
            result.topQueries.length === 0
              ? "No sampled prompts to show. Our model answers the category questions we ask it, and the source does not report the individual prompts behind this measurement."
              : "No prompts match these filters."
          }
        />
      ) : (
        <BrandLookupPagesTable
          rows={sortedPages}
          targetDomain={targetDomain}
          projectId={projectId}
          brand={result.resolvedTarget}
          showPlatform={pagePlatforms.length > 1}
          sort={pagesSort}
          onSortChange={setPagesSort}
          emptyMessage={
            result.topPages.length === 0
              ? "No cited sources to show. Our model has no web-search tool, so its answers cite nothing."
              : "No sources match these filters."
          }
        />
      )}

      <p
        style={{
          margin: 0,
          padding: "8px var(--pad, 24px)",
          fontSize: 12,
          color: "var(--text-3)",
        }}
      >
        {activeTab === "pages"
          ? `Pages cited alongside ${result.resolvedTarget} in the answers we sampled.`
          : `Prompts whose answer named ${result.resolvedTarget} in its text or its sources.`}
        {captionPlatform
          ? ` Measured on ${formatPlatformLabel(captionPlatform)}.`
          : ""}
      </p>
    </section>
  );
}
