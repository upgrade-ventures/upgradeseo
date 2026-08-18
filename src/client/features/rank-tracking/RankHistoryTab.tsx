import { useQuery } from "@tanstack/react-query";
import { getRankPositionMatrix } from "@/serverFunctions/rank-tracking";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";
import { RankTrackingHistoryMatrix } from "./RankTrackingHistoryMatrix";
import { RankTrackingOverview } from "./RankTrackingOverview";
import { InfoDotNote } from "./RankScreenParts";

/**
 * The History tab: how the tracked positions moved across completed checks.
 *
 * The distribution chart sits above the matrix because it answers the same
 * question at a glance; both read from checks that actually ran, so a set with
 * one check shows one column and says so rather than drawing a trend.
 */
export function RankHistoryTab({
  projectId,
  configId,
  device,
  rows,
}: {
  projectId: string;
  configId: string;
  device: "desktop" | "mobile";
  rows: RankTrackingRow[];
}) {
  const matrix = useQuery({
    queryKey: ["rankPositionMatrix", projectId, configId, device],
    queryFn: () =>
      getRankPositionMatrix({ data: { projectId, configId, device } }),
  });

  return (
    <>
      <RankTrackingOverview
        device={device}
        projectId={projectId}
        configId={configId}
      />

      <div style={{ paddingTop: 16 }}>
        <RankTrackingHistoryMatrix
          cells={matrix.data ?? []}
          keywords={rows.map((row) => ({
            trackingKeywordId: row.trackingKeywordId,
            keyword: row.keyword,
          }))}
          isLoading={matrix.isPending}
          isError={matrix.isError}
          onRetry={() => void matrix.refetch()}
        />
      </div>

      <InfoDotNote align="top" style={{ margin: "14px var(--pad,24px)" }}>
        Each column is one completed check, newest first, for{" "}
        {device === "desktop" ? "desktop" : "mobile"}. A dash means that check
        recorded no position for the keyword — it was outside the tracked depth
        or the source did not report it. It does not mean the check failed.
      </InfoDotNote>
    </>
  );
}
