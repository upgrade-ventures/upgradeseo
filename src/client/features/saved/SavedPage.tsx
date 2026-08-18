import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  InfoNote,
  PageHeaderBand,
  ScreenBody,
  SecondaryButton,
  StatusPill,
} from "@/client/components/prominence/Primitives";
import { SAVED_LIST_PANEL_ID } from "@/client/features/saved/SavedBulkBar";
import { SavedListAssignPanel } from "@/client/features/saved/SavedListAssignPanel";
import { SavedListsCard } from "@/client/features/saved/SavedListsCard";
import { SavedResultsCard } from "@/client/features/saved/SavedResultsCard";
import type { SavedSortField } from "@/client/features/saved/SavedTable";
import { compileSavedKeywordsFilters } from "@/client/features/saved-keywords/savedKeywordsFilterTypes";
import type { SAVED_KEYWORD_PAGE_SIZES } from "@/client/features/saved-keywords/savedKeywordsUtils";
import { useSavedKeywordsExport } from "@/client/features/saved-keywords/useSavedKeywordsExport";
import { useSavedKeywordsFilters } from "@/client/features/saved-keywords/useSavedKeywordsFilters";
import { useTagManage } from "@/client/features/saved-keywords/useTagManage";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { captureClientEvent } from "@/client/lib/posthog";
import {
  getSavedKeywords,
  refreshSavedKeywordMetrics,
  removeSavedKeywords,
  updateSavedKeywordTags,
} from "@/serverFunctions/keywords";
import type { SavedKeywordTag } from "@/types/keywords";

const FILTER_DEBOUNCE_MS = 350;

const SUBTITLE =
  "Lists you build while researching. A list is a tag on your saved keywords: pick one to work through just those.";

/**
 * The keyword sources this app can reach are free ones, and they answer for
 * volume, CPC and competition only. Difficulty and intent stay blank rather
 * than being filled with a plausible number.
 */
const SOURCE_NOTE =
  "Volume, CPC and competition come from the keyword sources connected to this project (Google Ads, Microsoft Ads or Bing Webmaster). The free sources report no difficulty or intent, so those cells stay blank unless a keyword was measured elsewhere.";

export function SavedPage({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof SAVED_KEYWORD_PAGE_SIZES)[number]>(50);
  const [sort, setSort] = useState<SavedSortField>("fetchedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removeError, setRemoveError] = useState<string | null>(null);
  // Both second steps are drawn in place above the table; the design has no
  // modal surface, so neither is an overlay.
  const [showConfirm, setShowConfirm] = useState(false);
  const [showListPanel, setShowListPanel] = useState(false);

  const filters = useSavedKeywordsFilters();
  const [committedFilterValues, setCommittedFilterValues] = useState(
    filters.values,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCommittedFilterValues(filters.values);
      setPage(1);
    }, FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters.values]);

  const appliedFilters = useMemo(
    () => compileSavedKeywordsFilters(committedFilterValues),
    [committedFilterValues],
  );
  const exportFilters = useMemo(
    () => compileSavedKeywordsFilters(filters.values),
    [filters.values],
  );

  const tagFilterKey = selectedTagIds.join("|");
  const hasActiveFilters =
    filters.activeFilterCount > 0 || selectedTagIds.length > 0;

  const queryInput = useMemo(
    () => ({
      projectId,
      ...appliedFilters,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      page,
      pageSize,
      sort,
      order,
    }),
    [appliedFilters, order, page, pageSize, projectId, selectedTagIds, sort],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["savedKeywords", projectId, queryInput],
    queryFn: () => getSavedKeywords({ data: queryInput }),
    placeholderData: keepPreviousData,
  });

  const savedKeywords = data?.rows ?? [];
  const availableTags = data?.tags ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const selectedRows = savedKeywords.filter((row) => selectedIds.has(row.id));
  const selectedRowIds = selectedRows.map((row) => row.id);
  const selectedCount = selectedRowIds.length;

  const selectedRowTags = useMemo<SavedKeywordTag[]>(() => {
    const map = new Map<string, SavedKeywordTag>();
    for (const row of selectedRows) {
      for (const tag of row.tags) {
        if (!map.has(tag.id)) map.set(tag.id, tag);
      }
    }
    return [...map.values()].toSorted((a, b) =>
      a.normalizedName.localeCompare(b.normalizedName),
    );
  }, [selectedRows]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, appliedFilters, tagFilterKey, sort, order]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const invalidateSavedKeywords = () =>
    queryClient.invalidateQueries({ queryKey: ["savedKeywords", projectId] });

  const removeMutation = useMutation({
    mutationFn: (savedKeywordIds: string[]) =>
      removeSavedKeywords({ data: { projectId, savedKeywordIds } }),
    onSuccess: (result) => {
      setSelectedIds(new Set());
      setShowConfirm(false);
      setRemoveError(null);
      void invalidateSavedKeywords();
      captureClientEvent("saved_keywords:bulk_remove", {
        count: result.deletedCount,
      });
      toast.success(
        `${result.deletedCount} keyword${result.deletedCount !== 1 ? "s" : ""} removed`,
      );
    },
    onError: (removeFailure) => {
      setRemoveError(getStandardErrorMessage(removeFailure, "Remove failed."));
    },
  });

  const tagMutation = useMutation({
    mutationFn: (input: {
      savedKeywordIds: string[];
      addTags?: string[];
      removeTagIds?: string[];
    }) =>
      updateSavedKeywordTags({
        data: {
          projectId,
          savedKeywordIds: input.savedKeywordIds,
          addTags: input.addTags,
          removeTagIds: input.removeTagIds,
        },
      }),
    onSuccess: (result) => {
      setSelectedIds(new Set());
      setShowListPanel(false);
      void invalidateSavedKeywords();
      toast.success(
        `Updated lists for ${result.taggedCount} keyword${result.taggedCount !== 1 ? "s" : ""}`,
      );
    },
    onError: (tagFailure) => {
      toast.error(
        getStandardErrorMessage(tagFailure, "Could not update lists"),
      );
    },
  });

  const refreshMetricsMutation = useMutation({
    mutationFn: () => refreshSavedKeywordMetrics({ data: { projectId } }),
    onSuccess: (result) => {
      void invalidateSavedKeywords();
      toast.success(
        `Updated stats for ${result.updated} keyword${result.updated !== 1 ? "s" : ""}`,
      );
    },
    onError: (refreshFailure) => {
      toast.error(
        getStandardErrorMessage(
          refreshFailure,
          "Could not update keyword stats.",
        ),
      );
    },
  });

  const tagManage = useTagManage(projectId);
  const exporter = useSavedKeywordsExport({
    projectId,
    appliedFilters: exportFilters,
    selectedTagIds,
    sort,
    order,
  });

  const exportDisabled = totalCount === 0 || exporter.exporting != null;
  // The panel belongs to a selection, so clearing the selection closes it.
  const listPanelOpen = showListPanel && selectedCount > 0;

  const handleSortChange = (field: SavedSortField) => {
    if (field === sort) {
      setOrder((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSort(field);
      setOrder("desc");
    }
    setPage(1);
  };

  const handleToggleTagFilter = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
    setPage(1);
  };

  const handleDeleteTag = async (tagId: string) => {
    const ok = await tagManage.deleteTag(tagId);
    if (ok) {
      setSelectedTagIds((current) => current.filter((id) => id !== tagId));
    }
  };

  const handleClearAllFilters = () => {
    filters.resetFilters();
    setSelectedTagIds([]);
    setPage(1);
  };

  return (
    <div style={{ padding: "0 0 48px" }}>
      <PageHeaderBand
        title="Saved Keywords"
        badge={
          isFetching && !isLoading ? (
            <StatusPill tone="info">Updating</StatusPill>
          ) : null
        }
        subtitle={SUBTITLE}
        actions={
          <>
            <SecondaryButton
              icon="i-refresh"
              onClick={() => refreshMetricsMutation.mutate()}
              disabled={totalCount === 0 || refreshMetricsMutation.isPending}
            >
              {refreshMetricsMutation.isPending
                ? "Updating stats…"
                : "Update stats"}
            </SecondaryButton>
            <SecondaryButton
              icon="i-download"
              onClick={() => void exporter.exportFilteredCsv()}
              disabled={exportDisabled}
            >
              {exporter.exporting === "csv" ? "Exporting…" : "CSV"}
            </SecondaryButton>
            <SecondaryButton
              icon="i-external"
              onClick={() => void exporter.exportFilteredSheets()}
              disabled={exportDisabled}
            >
              {exporter.exporting === "sheets" ? "Exporting…" : "Sheets"}
            </SecondaryButton>
          </>
        }
      />

      <ScreenBody style={{ display: "grid", gap: 16 }}>
        <SavedListsCard
          tags={availableTags}
          selectedTagIds={selectedTagIds}
          busyTagIds={tagManage.busyTagIds}
          isLoading={isLoading}
          isError={isError}
          canStartList={selectedCount > 0}
          onToggleTag={handleToggleTagFilter}
          onClearSelection={() => {
            setSelectedTagIds([]);
            setPage(1);
          }}
          onStartList={() => setShowListPanel(true)}
          onUpdateTag={(input) => void tagManage.updateTag(input)}
          onDeleteTag={(tagId) => void handleDeleteTag(tagId)}
        />

        <SavedResultsCard
          rows={savedKeywords}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          sort={sort}
          order={order}
          selectedIds={selectedIds}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          errorMessage={getStandardErrorMessage(
            error,
            "Saved keywords could not be loaded.",
          )}
          removeError={removeError}
          bulk={{
            selectedCount,
            exportingSelection: exporter.exportingSelection,
            removing: removeMutation.isPending,
            confirmingRemove: showConfirm && selectedCount > 0,
            onCopy: () => {
              void navigator.clipboard.writeText(
                selectedRows.map((row) => row.keyword).join("\n"),
              );
              toast.success(
                `${selectedCount} keyword${selectedCount !== 1 ? "s" : ""} copied`,
              );
            },
            onOpenTags: () => setShowListPanel((open) => !open),
            listPanelOpen: listPanelOpen,
            listPanel: listPanelOpen ? (
              <SavedListAssignPanel
                id={SAVED_LIST_PANEL_ID}
                availableTags={availableTags}
                selectedCount={selectedCount}
                selectedRowTags={selectedRowTags}
                isPending={tagMutation.isPending}
                onCancel={() => setShowListPanel(false)}
                onApply={({ addTags, removeTagIds }) =>
                  tagMutation.mutate({
                    savedKeywordIds: selectedRowIds,
                    addTags,
                    removeTagIds,
                  })
                }
              />
            ) : null,
            onExportCsv: () => exporter.exportSelectionCsv(selectedRows),
            onExportSheets: () =>
              void exporter.exportSelectionSheets(selectedRows),
            onAskRemove: () => setShowConfirm(true),
            onCancelRemove: () => {
              setShowConfirm(false);
              setRemoveError(null);
            },
            onConfirmRemove: () => removeMutation.mutate(selectedRowIds),
            onClear: () => {
              setSelectedIds(new Set());
              setShowConfirm(false);
              setShowListPanel(false);
            },
          }}
          onSortChange={handleSortChange}
          onSelectionChange={setSelectedIds}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
          onClearAllFilters={handleClearAllFilters}
          onRetry={() => void refetch()}
        />

        <InfoNote>{SOURCE_NOTE}</InfoNote>
      </ScreenBody>
    </div>
  );
}
