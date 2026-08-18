import { useQuery } from "@tanstack/react-query";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { getRankConfigTrend } from "@/serverFunctions/rank-tracking";
import type { RankTrackingConfig } from "@/types/schemas/rank-tracking";
import { Skeleton, StateBand } from "./RankScreenParts";
import { formatTimelineStamp } from "./rankFormat";
import type { RankLatestRun } from "./rankTypes";

type Entry = {
  key: string;
  tone: "success" | "danger" | "neutral";
  title: string;
  at: string;
};

/**
 * The Activity tab: every check this set has on record.
 *
 * Entries come from the runs themselves — the per-run trend for completed
 * checks, the polled run for one that is queued, running or failed, and the
 * config row for when the set was created. Nothing is narrated that the
 * database does not hold.
 */
export function RankActivityTab({
  projectId,
  config,
  device,
  latestRun,
}: {
  projectId: string;
  config: RankTrackingConfig;
  device: "desktop" | "mobile";
  latestRun: RankLatestRun;
}) {
  const trend = useQuery({
    queryKey: ["rankConfigTrend", projectId, config.id, device, 730],
    queryFn: () =>
      getRankConfigTrend({
        data: { projectId, configId: config.id, device, sinceDays: 730 },
      }),
  });

  if (trend.isError) {
    return (
      <StateBand
        action={
          <SecondaryButton onClick={() => void trend.refetch()}>
            Try again
          </SecondaryButton>
        }
      >
        Could not load the check history for this domain.
      </StateBand>
    );
  }

  if (trend.isPending) {
    return (
      <div style={{ padding: "14px var(--pad,24px)" }} aria-busy>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} width="70%" style={{ marginBottom: 13 }} />
        ))}
      </div>
    );
  }

  const entries: Entry[] = [];

  if (latestRun) {
    if (latestRun.status === "pending" || latestRun.status === "running") {
      entries.push({
        key: `run-${latestRun.id}`,
        tone: "neutral",
        title:
          latestRun.keywordsTotal > 0
            ? `Check ${latestRun.status === "pending" ? "queued" : "running"} · ${latestRun.keywordsChecked} of ${latestRun.keywordsTotal} keywords`
            : `Check ${latestRun.status === "pending" ? "queued" : "running"}`,
        at: latestRun.startedAt,
      });
    }
    if (latestRun.status === "failed") {
      entries.push({
        key: `run-${latestRun.id}`,
        tone: "danger",
        title: `Check failed · ${latestRun.errorMessage ?? "no reason was recorded"}`,
        at: latestRun.completedAt ?? latestRun.startedAt,
      });
    }
  }

  for (const point of trend.data) {
    const total =
      point.top3 + point.top4to10 + point.top11to20 + point.notRanking;
    // The trend reports each run's start time, so the entry is worded as when
    // the check ran rather than claiming a completion timestamp we don't have.
    entries.push({
      key: `check-${point.runId}`,
      tone: "success",
      title: `Check ran · ${total} keyword${total === 1 ? "" : "s"} recorded · ${point.top3} in the top 3`,
      at: point.checkedAt,
    });
  }

  entries.sort((a, b) => b.at.localeCompare(a.at));
  entries.push({
    key: "created",
    tone: "neutral",
    title: `Tracking set created for ${config.domain}`,
    at: config.createdAt,
  });

  return (
    <div style={{ padding: "14px var(--pad,24px)" }}>
      {entries.map((entry, index) => (
        <div
          key={entry.key}
          style={{
            position: "relative",
            paddingLeft: 15,
            // The last item stops the rule at the final entry, so the stacked
            // borders read as one line that ends where the log does.
            paddingBottom: index === entries.length - 1 ? undefined : 13,
            borderLeft: "1px solid var(--line)",
            marginLeft: 4,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: -4,
              top: 4,
              width: 7,
              height: 7,
              borderRadius: 999,
              background:
                entry.tone === "success"
                  ? "var(--success)"
                  : entry.tone === "danger"
                    ? "var(--danger)"
                    : "var(--text-3)",
              border: "2px solid var(--surface)",
            }}
          />
          <div style={{ fontSize: 12.5 }}>{entry.title}</div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-3)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTimelineStamp(entry.at)}
          </div>
        </div>
      ))}
    </div>
  );
}
