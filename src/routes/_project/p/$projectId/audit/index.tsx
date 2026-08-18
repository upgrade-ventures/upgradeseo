import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAuditHistory,
  getAuditResults,
  getAuditStatus,
} from "@/serverFunctions/audit";
import { auditSearchSchema } from "@/types/schemas/audit";
import { PageHeaderBand } from "@/client/components/prominence/Primitives";
import {
  PanelMessage,
  Skeleton,
  SkeletonRows,
} from "@/client/features/audit/AuditParts";
import { SCREEN_WRAP } from "@/client/features/audit/auditStyles";
import { LaunchView } from "@/client/features/audit/launch/LaunchView";
import {
  AuditScreen,
  type AuditTab,
} from "@/client/features/audit/results/AuditScreen";

export const Route = createFileRoute<"/_project/p/$projectId/audit/">(
  "/_project/p/$projectId/audit/",
)({
  validateSearch: auditSearchSchema,
  component: SiteAuditPage,
});

function SiteAuditPage() {
  const { projectId } = Route.useParams();
  const { auditId, tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );

  if (!auditId) {
    return (
      <LaunchView
        projectId={projectId}
        onAuditStarted={(id) => setSearchParams({ auditId: id })}
        onOpenAudit={(id) => setSearchParams({ auditId: id })}
      />
    );
  }

  return (
    <AuditDetail
      key={auditId}
      projectId={projectId}
      auditId={auditId}
      urlTab={tab}
      onUrlTabChange={(next) => setSearchParams({ tab: next })}
      onOpenAudit={(id) => setSearchParams({ auditId: id })}
      onStartNewCrawl={() => setSearchParams({ auditId: undefined })}
    />
  );
}

function AuditDetail({
  projectId,
  auditId,
  urlTab,
  onUrlTabChange,
  onOpenAudit,
  onStartNewCrawl,
}: {
  projectId: string;
  auditId: string;
  urlTab: "issues" | "pages" | "performance";
  onUrlTabChange: (tab: "issues" | "pages" | "performance") => void;
  onOpenAudit: (auditId: string) => void;
  onStartNewCrawl: () => void;
}) {
  // The design adds a fourth tab, Crawl history. The `tab` search param is
  // validated by a schema shared with the rest of the app and does not carry
  // that value, so history is held locally and the three original tabs keep
  // their deep links. Reset per crawl by the route's `key`.
  const [historyOpen, setHistoryOpen] = useState(false);
  const tab: AuditTab = historyOpen ? "history" : urlTab;

  const statusQuery = useQuery({
    queryKey: ["audit-status", projectId, auditId],
    queryFn: () => getAuditStatus({ data: { projectId, auditId } }),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 3000 : false,
  });

  const isComplete = statusQuery.data?.status === "completed";
  const isFailed = statusQuery.data?.status === "failed";

  // Failed crawls keep whatever pages were stored before they stopped
  // (persistence is per batch), so their results are fetched too and the
  // partial crawl is shown instead of a dead end.
  const resultsQuery = useQuery({
    queryKey: ["audit-results", projectId, auditId],
    queryFn: () => getAuditResults({ data: { projectId, auditId } }),
    enabled: isComplete || isFailed,
  });

  const historyQuery = useQuery({
    queryKey: ["audit-history", projectId],
    queryFn: () => getAuditHistory({ data: { projectId } }),
  });

  if (statusQuery.isLoading) {
    return (
      <div style={SCREEN_WRAP}>
        <PageHeaderBand
          title={<Skeleton width={220} height={17} />}
          subtitle={<Skeleton width={320} height={11} />}
        />
        <SkeletonRows />
      </div>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <div style={SCREEN_WRAP}>
        <PageHeaderBand title="Site Audit" />
        <PanelMessage tone="danger" title="We could not load this crawl.">
          It may have been deleted. Pick another crawl from the list, or start a
          new one.
        </PanelMessage>
      </div>
    );
  }

  return (
    <AuditScreen
      projectId={projectId}
      auditId={auditId}
      status={statusQuery.data}
      results={resultsQuery.data}
      resultsLoading={resultsQuery.isLoading}
      resultsError={resultsQuery.isError}
      history={historyQuery.data ?? []}
      historyLoading={historyQuery.isLoading}
      tab={tab}
      onTabChange={(next) => {
        setHistoryOpen(next === "history");
        if (next !== "history") onUrlTabChange(next);
      }}
      onOpenAudit={onOpenAudit}
      onStartNewCrawl={onStartNewCrawl}
    />
  );
}
