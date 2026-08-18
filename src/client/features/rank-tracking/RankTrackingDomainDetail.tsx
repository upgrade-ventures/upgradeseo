import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLatestRankResults } from "@/serverFunctions/rank-tracking";
import { captureClientEvent } from "@/client/lib/posthog";
import { computeScorecards } from "./rankTrackingScorecards";
import { RankTrackingDetailHeader } from "./RankTrackingDetailHeader";
import { RankKeywordsTab } from "./RankKeywordsTab";
import { RankHistoryTab } from "./RankHistoryTab";
import { RankCompetitorsTab } from "./RankCompetitorsTab";
import { RankActivityTab } from "./RankActivityTab";
import { AddKeywordsPanel } from "./AddKeywordsPanel";
import { CheckConfirmBand } from "./CheckConfirmBand";
import { useMetricsRefresh } from "./useMetricsRefresh";
import { useRankCheckTrigger } from "./useRankCheckTrigger";
import { useRankRunPolling } from "./useRankRunPolling";
import type {
  ComparePeriod,
  RankTrackingConfig,
} from "@/types/schemas/rank-tracking";
import type { RankTab } from "./rankTypes";

export function RankTrackingDomainDetail({
  config,
  projectId,
  onBack,
  onEdit,
  configPanel,
}: {
  config: RankTrackingConfig;
  projectId: string;
  onBack: () => void;
  onEdit: () => void;
  /** Inline band under the header, e.g. the tracking-settings form. */
  configPanel?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<RankTab>("keywords");
  const [showAddKeywords, setShowAddKeywords] = useState(false);
  const [pendingCheck, setPendingCheck] = useState<number | null>(null);
  const [comparePeriod, setComparePeriod] = useState<ComparePeriod>(
    config.scheduleInterval === "daily"
      ? "1d"
      : config.scheduleInterval === "monthly"
        ? "30d"
        : "7d",
  );
  const [device, setDevice] = useState<"desktop" | "mobile">(
    config.devices === "mobile" ? "mobile" : "desktop",
  );

  const results = useQuery({
    queryKey: ["rankTrackingResults", projectId, config.id, comparePeriod],
    queryFn: () =>
      getLatestRankResults({
        data: { projectId, configId: config.id, comparePeriod },
      }),
  });
  const latestRun = useRankRunPolling(projectId, config.id);

  const rows = results.data?.rows ?? [];
  const run = results.data?.run ?? null;
  // A run the workflow may have abandoned is reported, not silently treated as
  // in-flight: the check button has to come back.
  const isChecking =
    (latestRun?.status === "pending" || latestRun?.status === "running") &&
    !latestRun.maybeStale;

  const { startCheck, isBusy, isPending } = useRankCheckTrigger({
    configId: config.id,
    isRunning: isChecking,
    projectId,
    onSuccess: () => setPendingCheck(null),
  });
  const { refresh: refreshMetrics, isRefreshing: metricsRefreshing } =
    useMetricsRefresh(projectId, config.id);

  // A check is a job, and a job states its scope before it starts. There is no
  // size below which it starts unannounced.
  const requestCheck = () => {
    if (rows.length === 0 || isBusy) return;
    setPendingCheck(rows.length);
  };

  const handleKeywordsAdded = (result: {
    added: number;
    checkTriggered: boolean;
  }) => {
    for (const key of [
      "rankTrackingCostEstimate",
      "rankTrackingResults",
      "rankTrackingLatestRun",
    ]) {
      void queryClient.invalidateQueries({
        queryKey: [key, projectId, config.id],
      });
    }
    setShowAddKeywords(false);
    captureClientEvent("rank_tracking:keywords_add");
    toast.success(
      `${result.added} keyword${result.added !== 1 ? "s" : ""} added`,
    );
    if (!result.checkTriggered && result.added > 0) {
      toast.info("Use Check ranks now to measure these keywords");
    }
  };

  const scorecards = computeScorecards(rows, device);

  return (
    <div>
      <RankTrackingDetailHeader
        config={config}
        keywordCount={rows.length}
        keywordCountKnown={results.isSuccess}
        lastCheckedAt={run?.lastCheckedAt ?? null}
        latestRun={latestRun}
        isChecking={isChecking}
        checkBusy={isBusy}
        activeTab={tab}
        onTabChange={setTab}
        onBack={onBack}
        onEdit={onEdit}
        onAddKeywords={() => {
          setTab("keywords");
          setShowAddKeywords((current) => !current);
        }}
        addKeywordsOpen={showAddKeywords}
        onCheck={requestCheck}
        onRefreshMetrics={refreshMetrics}
        metricsRefreshing={metricsRefreshing}
      />

      {configPanel}

      {pendingCheck !== null ? (
        <CheckConfirmBand
          keywordCount={pendingCheck}
          devices={config.devices}
          isPending={isPending}
          onRunNow={() => startCheck({})}
          onCancel={() => setPendingCheck(null)}
        />
      ) : null}

      {latestRun?.maybeStale ? (
        <div
          style={{
            display: "flex",
            gap: 9,
            padding: "9px var(--pad,24px)",
            background: "var(--warning-soft)",
            borderBottom: "1px solid var(--warning-border)",
            fontSize: 12.5,
            color: "var(--text)",
          }}
          role="status"
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "var(--warning)",
              flexShrink: 0,
              marginTop: 5,
            }}
          />
          <span>
            The last check stopped responding and will be cleaned up
            automatically. Positions below are from the check before it.
          </span>
        </div>
      ) : null}

      <div
        role="tabpanel"
        id={`rank-panel-${tab}`}
        aria-label={`${tab} panel`}
        tabIndex={-1}
      >
        {tab === "keywords" ? (
          <RankKeywordsTab
            config={config}
            projectId={projectId}
            rows={rows}
            isLoading={results.isPending}
            isError={results.isError}
            onRetry={() => void results.refetch()}
            device={device}
            onDeviceChange={setDevice}
            comparePeriod={comparePeriod}
            onComparePeriodChange={setComparePeriod}
            runNotice={run?.status === "completed" ? run.errorMessage : null}
            // Freshness comes from the newest snapshot, not the newest run, so
            // a failed retry does not erase the fact that positions exist.
            hasMeasuredPositions={run?.lastCheckedAt != null}
            onAddKeywords={() => setShowAddKeywords(true)}
            addKeywordsPanel={
              showAddKeywords ? (
                <div
                  style={{
                    padding: "10px var(--pad,24px)",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <AddKeywordsPanel
                    configId={config.id}
                    projectId={projectId}
                    onSuccess={handleKeywordsAdded}
                    onCancel={() => setShowAddKeywords(false)}
                  />
                </div>
              ) : null
            }
          />
        ) : null}

        {tab === "history" ? (
          <RankHistoryTab
            projectId={projectId}
            configId={config.id}
            device={device}
            rows={rows}
          />
        ) : null}

        {tab === "competitors" ? (
          <RankCompetitorsTab
            projectId={projectId}
            domain={config.domain}
            rows={rows}
            avgPosition={scorecards.avgPosition}
          />
        ) : null}

        {tab === "activity" ? (
          <RankActivityTab
            projectId={projectId}
            config={config}
            device={device}
            latestRun={latestRun}
          />
        ) : null}
      </div>
    </div>
  );
}
