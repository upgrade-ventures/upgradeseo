import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditResults } from "@/serverFunctions/audit";
import type { getAuditHistory } from "@/serverFunctions/audit";
import { groupIssues } from "@/client/features/audit/results/issueGrouping";

export type AuditHistoryRow = Awaited<
  ReturnType<typeof getAuditHistory>
>[number];

function startedAtMs(row: { startedAt: string }): number {
  return new Date(row.startedAt).getTime();
}

/**
 * The crawl this one is measured against: the most recent completed crawl of
 * the same project that started before it.
 */
export function findPreviousCrawl(
  history: AuditHistoryRow[],
  currentAuditId: string,
  currentStartedAt: string,
): AuditHistoryRow | null {
  const current = startedAtMs({ startedAt: currentStartedAt });
  const earlier = history.filter(
    (row) =>
      row.id !== currentAuditId &&
      row.status === "completed" &&
      startedAtMs(row) < current,
  );
  return earlier.toSorted((a, b) => startedAtMs(b) - startedAtMs(a))[0] ?? null;
}

/**
 * "New" and "fixed" are diffs against the previous crawl, and the only place
 * that data exists is the previous crawl's own results. Fetching a second full
 * result set is not free, so it is deferred until the operator asks for a view
 * that needs it.
 */
export function useCrawlComparison({
  projectId,
  previousAuditId,
  enabled,
}: {
  projectId: string;
  previousAuditId: string | null;
  enabled: boolean;
}) {
  const query = useQuery({
    // Same key the current crawl's results use, so opening the previous crawl
    // afterwards is a cache hit rather than a second fetch.
    queryKey: ["audit-results", projectId, previousAuditId],
    queryFn: () =>
      getAuditResults({
        data: { projectId, auditId: previousAuditId ?? "" },
      }),
    enabled: enabled && previousAuditId !== null,
    // A completed crawl is immutable.
    staleTime: Infinity,
  });

  const previousGroups = useMemo(
    () => (query.data ? groupIssues(query.data.issues) : null),
    [query.data],
  );

  return {
    isAvailable: previousAuditId !== null,
    isLoading: query.isLoading && query.fetchStatus !== "idle",
    isError: query.isError,
    /** Issue types seen in the previous crawl, with the pages each touched. */
    previousGroups,
  };
}
