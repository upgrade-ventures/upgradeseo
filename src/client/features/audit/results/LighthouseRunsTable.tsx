import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { NoValue } from "@/client/components/prominence/Primitives";
import { JobStatusPill } from "@/client/components/prominence/JobStatus";
import {
  compareNullable,
  PanelMessage,
  SortHeader,
  useSort,
} from "@/client/features/audit/AuditParts";
import {
  BODY_ROW,
  DATA_TABLE,
  focusRing,
  HEAD_ROW,
  rowHoverHandlers,
  scoreColor,
  TABLE_SCROLL,
  TD_LEAD,
  TD_VALUE,
  TH_NUMERIC,
} from "@/client/features/audit/auditStyles";
import {
  countActiveFilters,
  PerformanceFilterBar,
  TableFilterToggle,
} from "@/client/features/audit/results/AuditResultsTableFilters";
import {
  EMPTY_PERFORMANCE_FILTERS,
  filterPerformanceRows,
  isLighthouseFailure,
  type PerformanceFilters,
  type PerformanceRowData,
} from "@/client/features/audit/results/AuditResultsTableFilterLogic";

type SortKey =
  | "url"
  | "strategy"
  | "status"
  | "performanceScore"
  | "accessibilityScore"
  | "seoScore"
  | "lcpMs"
  | "cls"
  | "inpMs"
  | "ttfbMs";

/**
 * The full run table.
 *
 * Not in the design, which draws only the four medians and three slowest
 * pages. It is the only route to the per-page Lighthouse issue screen and it
 * carries the Core Web Vitals the medians summarise, so it keeps working —
 * restyled onto the design's table rules.
 */
export function LighthouseRunsTable({
  auditId,
  projectId,
  rows,
}: {
  auditId: string;
  projectId: string;
  rows: PerformanceRowData[];
}) {
  const [filters, setFilters] = useState<PerformanceFilters>(
    EMPTY_PERFORMANCE_FILTERS,
  );
  const [showFilters, setShowFilters] = useState(false);
  const { sort, toggle } = useSort<SortKey>("performanceScore");

  const filtered = useMemo(
    () => filterPerformanceRows(rows, filters),
    [filters, rows],
  );

  const sorted = useMemo(() => {
    const direction = sort.desc ? -1 : 1;
    return filtered.toSorted((left, right) => {
      if (sort.key === "url") {
        return (
          direction * (left.pagePath ?? "").localeCompare(right.pagePath ?? "")
        );
      }
      if (sort.key === "strategy") {
        return direction * left.strategy.localeCompare(right.strategy);
      }
      if (sort.key === "status") {
        return (
          direction *
          (Number(isLighthouseFailure(left)) -
            Number(isLighthouseFailure(right)))
        );
      }
      return compareNullable(left[sort.key], right[sort.key], direction);
    });
  }, [filtered, sort]);

  const activeFilterCount = countActiveFilters(
    filters,
    EMPTY_PERFORMANCE_FILTERS,
  );

  return (
    <>
      <TableFilterToggle
        showFilters={showFilters}
        onToggle={() => setShowFilters((current) => !current)}
        activeFilterCount={activeFilterCount}
        resultCount={sorted.length}
        totalCount={rows.length}
        label="runs"
      />
      {showFilters ? (
        <PerformanceFilterBar
          filters={filters}
          onChange={setFilters}
          activeFilterCount={activeFilterCount}
          onReset={() => setFilters(EMPTY_PERFORMANCE_FILTERS)}
        />
      ) : null}

      {sorted.length === 0 ? (
        <PanelMessage title="No Lighthouse runs match these filters." />
      ) : (
        <div style={TABLE_SCROLL}>
          <table style={{ ...DATA_TABLE, minWidth: 900 }}>
            <thead>
              <tr style={HEAD_ROW}>
                <SortHeader
                  label="URL"
                  sortKey="url"
                  sort={sort}
                  onSort={toggle}
                  lead
                />
                <SortHeader
                  label="Device"
                  sortKey="strategy"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="Run"
                  sortKey="status"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="Perf"
                  sortKey="performanceScore"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="A11y"
                  sortKey="accessibilityScore"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="SEO"
                  sortKey="seoScore"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="LCP"
                  sortKey="lcpMs"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="CLS"
                  sortKey="cls"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="INP"
                  sortKey="inpMs"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="TTFB"
                  sortKey="ttfbMs"
                  sort={sort}
                  onSort={toggle}
                />
                <th scope="col" style={TH_NUMERIC}>
                  <span className="sr-only">Issues</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const failed = isLighthouseFailure(row);
                return (
                  <tr key={row.id} style={BODY_ROW} {...rowHoverHandlers}>
                    <td style={TD_LEAD}>
                      <span title={row.pageUrl ?? undefined}>
                        {row.pagePath ?? <NoValue />}
                      </span>
                    </td>
                    <td style={{ ...TD_VALUE, textTransform: "capitalize" }}>
                      {row.strategy}
                    </td>
                    <td style={TD_VALUE}>
                      {/* One Lighthouse run per page is a job of its own, so it
                          reports in the same five words as every other job.
                          "ok" was a sixth word for Finished. */}
                      <JobStatusPill
                        state={failed ? "failed" : "finished"}
                        title={
                          failed
                            ? (row.errorMessage ??
                              "Lighthouse returned no category scores")
                            : undefined
                        }
                      />
                    </td>
                    <ScoreCell score={row.performanceScore} />
                    <ScoreCell score={row.accessibilityScore} />
                    <ScoreCell score={row.seoScore} />
                    <td style={TD_VALUE}>
                      {row.lcpMs == null ? (
                        <NoValue />
                      ) : (
                        `${(row.lcpMs / 1000).toFixed(1)}s`
                      )}
                    </td>
                    <td style={TD_VALUE}>
                      {row.cls == null ? <NoValue /> : row.cls.toFixed(3)}
                    </td>
                    <td style={TD_VALUE}>
                      {row.inpMs == null ? (
                        <NoValue />
                      ) : (
                        `${Math.round(row.inpMs)}ms`
                      )}
                    </td>
                    <td style={TD_VALUE}>
                      {row.ttfbMs == null ? (
                        <NoValue />
                      ) : (
                        `${Math.round(row.ttfbMs)}ms`
                      )}
                    </td>
                    <td style={{ ...TD_VALUE, whiteSpace: "nowrap" }}>
                      {row.r2Key && !failed ? (
                        <Link
                          to="/p/$projectId/audit/issues/$resultId"
                          params={{ projectId, resultId: row.id }}
                          search={{ auditId, category: "performance" }}
                          {...focusRing<HTMLAnchorElement>()}
                          style={{ outline: "none" }}
                        >
                          View issues
                        </Link>
                      ) : (
                        <NoValue />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ScoreCell({ score }: { score: number | null }) {
  return (
    <td
      style={{
        ...TD_VALUE,
        color: score == null ? undefined : scoreColor(score),
        fontWeight: score == null ? undefined : 600,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {score ?? <NoValue />}
    </td>
  );
}
