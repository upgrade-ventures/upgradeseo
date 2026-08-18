import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getLatestRankRun } from "@/serverFunctions/rank-tracking";

/**
 * Polls the latest rank check run for a config.
 *
 * A job reports its result, so the transition out of pending/running is where
 * the outcome is announced and the table is refreshed. Both live in an effect
 * rather than in `refetchInterval`, which React Query may call more than once
 * per state and which must stay a pure scheduling decision.
 */
export function useRankRunPolling(projectId: string, configId: string) {
  const queryClient = useQueryClient();
  const previousStatus = useRef<string | undefined>(undefined);

  const { data: latestRun } = useQuery({
    queryKey: ["rankTrackingLatestRun", projectId, configId],
    queryFn: () => getLatestRankRun({ data: { projectId, configId } }),
    // Keep polling active runs, including stale ones: the cron handler cleans
    // them up and the transition is what the screen is waiting for.
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ||
      query.state.data?.status === "running"
        ? 3000
        : false,
  });

  useEffect(() => {
    const status = latestRun?.status;
    const previous = previousStatus.current;
    previousStatus.current = status;

    const wasActive = previous === "running" || previous === "pending";
    if (!wasActive || !latestRun) return;

    if (status === "completed") {
      void queryClient.invalidateQueries({
        queryKey: ["rankTrackingResults", projectId, configId],
      });
      const checked = latestRun.keywordsChecked;
      toast.success(
        latestRun.errorMessage
          ? `Rank check finished · ${checked} keyword${checked === 1 ? "" : "s"} checked · ${latestRun.errorMessage}`
          : `Rank check finished · ${checked} keyword${checked === 1 ? "" : "s"} checked`,
      );
      return;
    }

    if (status === "failed") {
      void queryClient.invalidateQueries({
        queryKey: ["rankTrackingResults", projectId, configId],
      });
      toast.error(
        `Rank check failed · ${latestRun.errorMessage ?? "no reason was recorded"}`,
      );
    }
  }, [latestRun, projectId, configId, queryClient]);

  return latestRun;
}
