import { useMemo, useState } from "react";
import { NoValue } from "@/client/components/prominence/Primitives";
import {
  compareNullable,
  PanelMessage,
  SortHeader,
  useSort,
} from "@/client/features/audit/AuditParts";
import {
  BODY_ROW,
  DATA_TABLE,
  HEAD_ROW,
  rowHoverHandlers,
  TABLE_SCROLL,
  TD_LEAD,
  TD_VALUE,
} from "@/client/features/audit/auditStyles";
import {
  extractHostname,
  extractPathname,
} from "@/client/features/audit/shared";
import {
  countActiveFilters,
  PagesFilterBar,
  TableFilterToggle,
} from "@/client/features/audit/results/AuditResultsTableFilters";
import {
  EMPTY_PAGES_FILTERS,
  filterPages,
  type PageRow,
  type PagesFilters,
} from "@/client/features/audit/results/AuditResultsTableFilterLogic";
import { resolveIssueSeverity } from "@/client/features/audit/results/issueGrouping";
import type { AuditResultsData } from "@/client/features/audit/results/types";

type SortKey = "url" | "status" | "depth" | "lighthouse" | "issues";

/**
 * Path shown in the URL cell. Redirect sources on another host (the apex
 * domain 301ing to www) would otherwise render identically to their target, so
 * the host is kept whenever it differs from the site's canonical one.
 */
function displayPath(url: string, canonicalHost: string): string {
  const host = extractHostname(url);
  const path = extractPathname(url);
  return host === canonicalHost ? path : host + path;
}

/**
 * The host most of the site's real (2xx) pages live on. The start URL's host is
 * only a fallback: audits often start from the apex domain of a site that
 * canonicalizes to www, and prefixing every row with the host is exactly the
 * noise this display avoids.
 */
function predominantHost(pages: PageRow[], startUrl: string): string {
  const counts = new Map<string, number>();
  for (const page of pages) {
    if (page.statusCode === null || page.statusCode >= 300) continue;
    const host = extractHostname(page.url);
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  let best = extractHostname(startUrl);
  let bestCount = 0;
  for (const [host, count] of counts) {
    if (count > bestCount) {
      best = host;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The page's Lighthouse performance score.
 *
 * Mobile wins when both strategies ran, because mobile is what Google indexes
 * and ranks on. A page with no Lighthouse run has no score — not a zero.
 */
function pageScore(
  pageId: string,
  lighthouse: AuditResultsData["lighthouse"],
): number | null {
  const rows = lighthouse.filter((row) => row.pageId === pageId);
  const preferred =
    rows.find(
      (row) => row.strategy === "mobile" && row.performanceScore != null,
    ) ?? rows.find((row) => row.performanceScore != null);
  return preferred?.performanceScore ?? null;
}

/** What the Issues column says for one page. */
function issueSummary(
  page: PageRow,
  bySeverity: { critical: number; warning: number; info: number } | undefined,
): string {
  if (page.fetchClass === "blocked") return "Blocked";
  if (page.statusCode !== null && page.statusCode >= 400) return "Broken";
  if (!bySeverity) return "No issues";
  if (bySeverity.critical > 0) return `${bySeverity.critical} critical`;
  if (bySeverity.warning > 0) {
    return `${bySeverity.warning} warning${bySeverity.warning === 1 ? "" : "s"}`;
  }
  if (bySeverity.info > 0) {
    return `${bySeverity.info} notice${bySeverity.info === 1 ? "" : "s"}`;
  }
  return "No issues";
}

/** Rank for sorting the Issues column: worst first when descending. */
function issueWeight(
  page: PageRow,
  bySeverity: { critical: number; warning: number; info: number } | undefined,
): number {
  if (page.fetchClass === "blocked") return 1000;
  if (page.statusCode !== null && page.statusCode >= 400) return 900;
  if (!bySeverity) return 0;
  return bySeverity.critical * 100 + bySeverity.warning * 10 + bySeverity.info;
}

export function PagesPanel({
  pages,
  startUrl,
  issues,
  lighthouse,
}: {
  pages: AuditResultsData["pages"];
  startUrl: string;
  issues: AuditResultsData["issues"];
  lighthouse: AuditResultsData["lighthouse"];
}) {
  const [filters, setFilters] = useState<PagesFilters>(EMPTY_PAGES_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  // URL order reads as a site inventory; status-first would open the table on
  // its most boring rows (redirects) whenever a site has no errors.
  const { sort, toggle } = useSort<SortKey>("url");

  const canonicalHost = useMemo(
    () => predominantHost(pages, startUrl),
    [pages, startUrl],
  );

  const severityByPage = useMemo(() => {
    const map = new Map<
      string,
      { critical: number; warning: number; info: number }
    >();
    for (const issue of issues) {
      if (issue.pageId === null) continue;
      let entry = map.get(issue.pageId);
      if (!entry) {
        entry = { critical: 0, warning: 0, info: 0 };
        map.set(issue.pageId, entry);
      }
      entry[resolveIssueSeverity(issue)] += 1;
    }
    return map;
  }, [issues]);

  const rows = useMemo(
    () =>
      filterPages(pages, filters).map((page) => {
        const bySeverity = severityByPage.get(page.id);
        return {
          page,
          path: displayPath(page.url, canonicalHost),
          score: pageScore(page.id, lighthouse),
          issueLabel: issueSummary(page, bySeverity),
          issueWeight: issueWeight(page, bySeverity),
        };
      }),
    [canonicalHost, filters, lighthouse, pages, severityByPage],
  );

  const sorted = useMemo(() => {
    const direction = sort.desc ? -1 : 1;
    return rows.toSorted((left, right) => {
      if (sort.key === "url")
        return direction * left.path.localeCompare(right.path);
      if (sort.key === "issues") {
        return direction * (left.issueWeight - right.issueWeight);
      }
      const a =
        sort.key === "status"
          ? left.page.statusCode
          : sort.key === "depth"
            ? left.page.crawlDepth
            : left.score;
      const b =
        sort.key === "status"
          ? right.page.statusCode
          : sort.key === "depth"
            ? right.page.crawlDepth
            : right.score;
      return compareNullable(a, b, direction);
    });
  }, [rows, sort]);

  const activeFilterCount = countActiveFilters(filters, EMPTY_PAGES_FILTERS);

  return (
    <>
      <TableFilterToggle
        showFilters={showFilters}
        onToggle={() => setShowFilters((current) => !current)}
        activeFilterCount={activeFilterCount}
        resultCount={sorted.length}
        totalCount={pages.length}
        label="pages"
      />
      {showFilters ? (
        <PagesFilterBar
          filters={filters}
          onChange={setFilters}
          activeFilterCount={activeFilterCount}
          onReset={() => setFilters(EMPTY_PAGES_FILTERS)}
        />
      ) : null}

      {pages.length === 0 ? (
        <PanelMessage title="No pages were stored for this crawl.">
          The crawler reached no page it could read. Run a new crawl, or check
          whether the site blocks automated requests.
        </PanelMessage>
      ) : sorted.length === 0 ? (
        <PanelMessage title="No pages match these filters." />
      ) : (
        <div style={TABLE_SCROLL}>
          <table style={DATA_TABLE}>
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
                  label="Status"
                  sortKey="status"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="Depth"
                  sortKey="depth"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="Lighthouse"
                  sortKey="lighthouse"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHeader
                  label="Issues"
                  sortKey="issues"
                  sort={sort}
                  onSort={toggle}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.page.id} style={BODY_ROW} {...rowHoverHandlers}>
                  <td style={TD_LEAD}>
                    <a
                      href={row.page.url}
                      target="_blank"
                      rel="noreferrer"
                      title={row.page.url}
                      style={{ color: "inherit" }}
                    >
                      {row.path}
                    </a>
                  </td>
                  <td style={TD_VALUE}>{row.page.statusCode ?? <NoValue />}</td>
                  <td style={TD_VALUE}>{row.page.crawlDepth ?? <NoValue />}</td>
                  <td style={TD_VALUE}>{row.score ?? <NoValue />}</td>
                  <td style={TD_VALUE}>{row.issueLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
