import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ga4OrganicTiles } from "@/client/features/dashboard/Ga4OrganicTiles";
import { SearchPerformanceTiles } from "@/client/features/dashboard/SearchPerformanceTiles";
import { ActivityTimeline } from "@/client/features/dashboard/ActivityTimeline";
import { AttentionCard } from "@/client/features/dashboard/AttentionCard";
import { InProgressCard } from "@/client/features/dashboard/InProgressCard";
import { RecentActivityCard } from "@/client/features/dashboard/RecentActivityCard";
import { ConnectionsCard } from "@/client/features/dashboard/ConnectionsCard";
import {
  PageHeaderBand,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  Tab,
  TabStrip,
} from "@/client/components/prominence/Primitives";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getDashboardActivation,
  getDashboardOverview,
  refreshDashboardBacklinkSnapshot,
} from "@/serverFunctions/dashboard";
import { startAudit } from "@/serverFunctions/audit";

export function DashboardPage({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const activationQuery = useQuery({
    queryKey: ["dashboardActivation", projectId],
    queryFn: () => getDashboardActivation({ data: { projectId } }),
  });
  // Local, not in the URL: the design treats these as a view toggle rather than
  // a destination, and the sidebar breadcrumb stays "Dashboard" across all three.
  const [tab, setTab] = useState<"overview" | "activity" | "connections">(
    "overview",
  );
  const auditMutation = useMutation({
    mutationFn: (startUrl: string) =>
      startAudit({ data: { projectId, startUrl } }),
    onSuccess: () => {
      toast.success("Audit started");
      void queryClient.invalidateQueries({
        queryKey: ["dashboardOverview", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["dashboardActivity", projectId],
      });
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "Could not start the audit")),
  });
  const overviewQuery = useQuery({
    queryKey: ["dashboardOverview", projectId],
    queryFn: () => getDashboardOverview({ data: { projectId } }),
  });

  const activation = activationQuery.data;
  const overview = overviewQuery.data;

  // Visit-triggered backlink snapshot: fire once per page view when the
  // overview reports a missing or stale snapshot for a project with a domain.
  // The server re-checks freshness, so a stray double-fire costs nothing.
  const refreshMutation = useMutation({
    mutationFn: () => refreshDashboardBacklinkSnapshot({ data: { projectId } }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["dashboardOverview", projectId],
      }),
  });
  const refreshFiredRef = useRef(false);
  const needsSnapshot =
    activation?.domain != null &&
    overview !== undefined &&
    (overview.backlinks === null || overview.backlinks.stale);
  useEffect(() => {
    if (!needsSnapshot || refreshFiredRef.current) return;
    refreshFiredRef.current = true;
    refreshMutation.mutate();
  }, [needsSnapshot, refreshMutation]);

  if (activationQuery.isError) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-6">
        <div className="alert alert-error">
          {getStandardErrorMessage(activationQuery.error)}
        </div>
      </div>
    );
  }

  // Wait for the overview too: rendering cards from `overview === undefined`
  // flashes their empty states (and reshuffles the data-first sort) once the
  // real data lands. An overview error falls through so the page still loads.
  if (!activation || overviewQuery.isPending) {
    return (
      <div
        className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-4 md:px-6 md:py-6"
        aria-busy
      >
        <div className="skeleton h-8 w-52" />
        <div className="skeleton h-36" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="skeleton h-44" />
          <div className="skeleton h-44" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 48px" }}>
      <PageHeaderBand
        title={activation.domain ?? "Dashboard"}
        badge={
          activation.gsc.connected ? (
            <StatusPill tone="success" icon="i-trend">
              Tracking
            </StatusPill>
          ) : null
        }
        subtitle={
          activation.domain
            ? "Search performance, site health and recent activity."
            : "Set a domain to start tracking this site."
        }
        actions={
          <>
            <SecondaryButton
              icon="i-refresh"
              onClick={() =>
                void navigate({
                  to: "/p/$projectId/rank-tracking",
                  params: { projectId },
                  search: {},
                })
              }
            >
              Check ranks now
            </SecondaryButton>
            <PrimaryButton
              icon="i-play"
              // Nothing to crawl without a domain, and the crawl needs a real
              // start URL rather than a guess.
              disabled={!activation.domain || auditMutation.isPending}
              onClick={() => {
                if (!activation.domain) return;
                auditMutation.mutate(`https://${activation.domain}`);
              }}
            >
              {auditMutation.isPending ? "Starting…" : "Run site audit"}
            </PrimaryButton>
          </>
        }
        tabs={
          <TabStrip>
            <Tab
              active={tab === "overview"}
              onClick={() => setTab("overview")}
              controls="dashboard-panel"
            >
              Overview
            </Tab>
            <Tab
              active={tab === "activity"}
              onClick={() => setTab("activity")}
              controls="dashboard-panel"
            >
              Activity
            </Tab>
            <Tab
              active={tab === "connections"}
              onClick={() => setTab("connections")}
              controls="dashboard-panel"
            >
              Connections
            </Tab>
          </TabStrip>
        }
      />

      {/* ACTIVITY — full-bleed timeline plus the design's retention note. */}
      {tab === "activity" ? (
        <div id="dashboard-panel" role="tabpanel">
          <div style={{ padding: "14px var(--pad, 24px)" }}>
            <ActivityTimeline projectId={projectId} />
          </div>
          <div
            style={{
              display: "flex",
              gap: 9,
              margin: "14px var(--pad, 24px)",
              padding: "9px 12px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "var(--subtle)",
              fontSize: 12.5,
              color: "var(--text-2)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--info)",
                flexShrink: 0,
                marginTop: 5,
              }}
            />
            <span>
              Everything that touched this site appears here, including
              scheduled runs nobody started by hand.
            </span>
          </div>
        </div>
      ) : null}

      {/* CONNECTIONS */}
      {tab === "connections" ? (
        <div id="dashboard-panel" role="tabpanel">
          <ConnectionsCard projectId={projectId} activation={activation} />
        </div>
      ) : null}

      {/* OVERVIEW */}
      {tab === "overview" ? (
        <div
          id="dashboard-panel"
          role="tabpanel"
          style={{
            maxWidth: 1120,
            padding: "20px var(--pad, 24px)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <AttentionCard
            projectId={projectId}
            audit={overview?.audit ?? null}
            loading={overviewQuery.isPending}
          />

          <SearchPerformanceTiles
            projectId={projectId}
            summary={overview?.search ?? null}
            loading={overviewQuery.isPending}
          />

          {/* Directly under Search Console: the click, then what followed it. */}
          <Ga4OrganicTiles
            projectId={projectId}
            connected={activation.ga4.connected}
          />

          {/* The design's two-up row. align-items:start so the shorter card
              does not stretch to match the taller one. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 20,
              alignItems: "start",
            }}
          >
            <InProgressCard
              audit={overview?.audit ?? null}
              rankRunning={false}
            />
            <RecentActivityCard projectId={projectId} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
