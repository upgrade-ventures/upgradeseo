import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import { captureClientEvent } from "@/client/lib/posthog";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeTrackingKeywords } from "@/serverFunctions/rank-tracking";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";
import { buildRankTrackingExport } from "./RankTrackingTableParts";
import {
  KeywordTrendPanel,
  type KeywordTrendTarget,
} from "./KeywordTrendPanel";
import { StateBand, TABLE, TABLE_SCROLLER } from "./RankScreenParts";
import {
  KeywordRow,
  KeywordSelectionBar,
  KeywordTableHead,
} from "./RankKeywordCells";
import {
  TableSkeleton,
  sortRows,
  type SortState,
} from "./RankKeywordCellParts";

/**
 * The design's keyword table: one row per tracked keyword, a position column
 * per tracked device, the page that ranks and the SERP features seen on it.
 *
 * Positions are read from the latest snapshot the check wrote. A missing
 * position is never drawn as a zero: it is either "not measured" (no check has
 * reported on this keyword) or "not in top N" (a check reported it absent),
 * and those are two different cells.
 */
export function RankTrackingTable({
  rows,
  totalCount,
  isLoading,
  isError,
  onRetry,
  narrowed,
  onResetView,
  onAddKeywords,
  showDesktop,
  showMobile,
  serpDepth,
  domain,
  configId,
  projectId,
  locationCode,
  locationName,
}: {
  rows: RankTrackingRow[];
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** True when a view or filter is hiding part of the set. */
  narrowed: boolean;
  onResetView: () => void;
  onAddKeywords: () => void;
  showDesktop: boolean;
  showMobile: boolean;
  serpDepth: number;
  domain: string;
  configId: string;
  projectId: string;
  locationCode: number;
  locationName?: string | null;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [sort, setSort] = useState<SortState>({
    key: showDesktop ? "desktop" : "mobile",
    asc: true,
  });
  const [cursor, setCursor] = useState(-1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [trendTarget, setTrendTarget] = useState<KeywordTrendTarget | null>(
    null,
  );
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  // Selection survives a view change, but only rows on screen can be acted on:
  // exporting or removing something the user cannot see is a surprise.
  const selectedRows = useMemo(
    () => sorted.filter((row) => selected.has(row.trackingKeywordId)),
    [sorted, selected],
  );
  const allSelected =
    sorted.length > 0 && selectedRows.length === sorted.length;

  // Any change to the selection retracts an armed confirm: the question was
  // about the rows that were ticked when it was asked.
  const toggleRow = useCallback((id: string) => {
    setShowConfirm(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => {
    setShowConfirm(false);
    setSelected(new Set());
  };

  const toggleAll = () => {
    setShowConfirm(false);
    setSelected((current) => {
      const next = new Set(current);
      const selectAll = sorted.some((row) => !next.has(row.trackingKeywordId));
      for (const row of sorted) {
        if (selectAll) next.add(row.trackingKeywordId);
        else next.delete(row.trackingKeywordId);
      }
      return next;
    });
  };

  const openTrend = useCallback((row: RankTrackingRow) => {
    setTrendTarget({
      trackingKeywordId: row.trackingKeywordId,
      keyword: row.keyword,
    });
  }, []);

  // J/K row navigation, which the design advertises in the views bar but never
  // implements. Enter opens the position history for the row under the cursor.
  // Suspended while a panel is open so the keys belong to the panel, not the
  // table behind it.
  const panelOpen = showConfirm || trendTarget !== null;
  useEffect(() => {
    if (panelOpen || sorted.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key !== "j" && key !== "k" && event.key !== "Enter") return;
      if (event.key === "Enter") {
        const row = sorted[cursor];
        if (!row) return;
        event.preventDefault();
        openTrend(row);
        return;
      }
      event.preventDefault();
      setCursor((current) => {
        const next =
          key === "j"
            ? Math.min(current + 1, sorted.length - 1)
            : Math.max(current - 1, 0);
        rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cursor, panelOpen, openTrend, sorted]);

  const removeMutation = useMutation({
    mutationFn: (keywordIds: string[]) =>
      removeTrackingKeywords({ data: { projectId, configId, keywordIds } }),
    onSuccess: (result) => {
      clearSelection();
      setShowConfirm(false);
      void queryClient.invalidateQueries({
        queryKey: ["rankTrackingResults", projectId, configId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["rankTrackingCostEstimate", projectId, configId],
      });
      toast.success(
        `${result.removed} keyword${result.removed !== 1 ? "s" : ""} removed · history is kept`,
      );
    },
    onError: (error) => {
      toast.error(getStandardErrorMessage(error, "Failed to remove keywords"));
    },
  });

  const exportSelection = (destination: "csv" | "sheets") => {
    const { headers, rows: exportRows } = buildRankTrackingExport(
      selectedRows,
      showDesktop,
      showMobile,
      locationName,
    );
    if (destination === "sheets") {
      void exportTableToSheets({
        headers,
        rows: exportRows,
        feature: "rank_tracking",
      });
      return;
    }
    const csvRows = exportRows.map((row) =>
      row.map((cell, index) =>
        index === 3 && typeof cell === "number" ? cell.toFixed(2) : cell,
      ),
    );
    downloadCsv(
      `rank-tracking-${domain}-selected.csv`,
      buildCsv(headers, csvRows),
    );
    captureClientEvent("rank_tracking:export_csv", { scope: "selection" });
  };

  if (isError) {
    return (
      <StateBand
        action={<SecondaryButton onClick={onRetry}>Try again</SecondaryButton>}
      >
        Could not load the tracked keywords for this domain.
      </StateBand>
    );
  }

  if (isLoading) {
    return <TableSkeleton showDesktop={showDesktop} showMobile={showMobile} />;
  }

  if (sorted.length === 0) {
    return narrowed ? (
      <StateBand
        action={
          <SecondaryButton onClick={onResetView}>
            Show all keywords
          </SecondaryButton>
        }
      >
        No tracked keyword matches this view.
      </StateBand>
    ) : (
      <StateBand
        action={
          <PrimaryButton onClick={onAddKeywords}>Add keywords</PrimaryButton>
        }
      >
        {totalCount === 0
          ? "No keywords are tracked for this domain yet."
          : "No keywords to show."}
      </StateBand>
    );
  }

  return (
    <>
      {trendTarget ? (
        <KeywordTrendPanel
          target={trendTarget}
          projectId={projectId}
          configId={configId}
          domain={domain}
          locationCode={locationCode}
          locationName={locationName ?? undefined}
          serpDepth={serpDepth}
          onClose={() => setTrendTarget(null)}
        />
      ) : null}

      {selectedRows.length > 0 ? (
        <KeywordSelectionBar
          count={selectedRows.length}
          confirming={showConfirm}
          removing={removeMutation.isPending}
          onExportCsv={() => exportSelection("csv")}
          onExportSheets={() => exportSelection("sheets")}
          onRemove={() => setShowConfirm(true)}
          onConfirmRemove={() =>
            removeMutation.mutate(
              selectedRows.map((row) => row.trackingKeywordId),
            )
          }
          onCancelRemove={() => setShowConfirm(false)}
          onClear={clearSelection}
        />
      ) : null}

      <div style={TABLE_SCROLLER}>
        <table style={TABLE}>
          <KeywordTableHead
            sort={sort}
            onSort={setSort}
            allSelected={allSelected}
            partiallySelected={selectedRows.length > 0 && !allSelected}
            rowCount={sorted.length}
            onToggleAll={toggleAll}
            showDesktop={showDesktop}
            showMobile={showMobile}
            locationName={locationName}
          />
          <tbody>
            {sorted.map((row, index) => (
              <KeywordRow
                key={row.trackingKeywordId}
                row={row}
                highlight={index === cursor}
                rowRef={(element) => {
                  rowRefs.current[index] = element;
                }}
                selected={selected.has(row.trackingKeywordId)}
                onToggle={() => toggleRow(row.trackingKeywordId)}
                onOpenTrend={() => openTrend(row)}
                showDesktop={showDesktop}
                showMobile={showMobile}
                serpDepth={serpDepth}
                domain={domain}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
