import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRankTrackingConfigs } from "@/serverFunctions/rank-tracking";
import {
  PageHeaderBand,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { RankTrackingDomainDetail } from "@/client/features/rank-tracking/RankTrackingDomainDetail";
import { RankTrackingConfigPanel } from "@/client/features/rank-tracking/RankTrackingConfigPanel";
import {
  Skeleton,
  StateBand,
} from "@/client/features/rank-tracking/RankScreenParts";

export const Route = createFileRoute(
  "/_project/p/$projectId/rank-tracking/$configId",
)({
  component: RankTrackingConfigRoute,
});

function RankTrackingConfigRoute() {
  const { projectId, configId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  const configs = useQuery({
    queryKey: ["rankTrackingConfigs", projectId],
    queryFn: () => getRankTrackingConfigs({ data: { projectId } }),
  });

  const config = configs.data?.find((entry) => entry.id === configId) ?? null;

  const invalidateConfigs = () => {
    for (const key of ["rankTrackingConfigs", "rankTrackingConfigSummaries"]) {
      void queryClient.invalidateQueries({ queryKey: [key, projectId] });
    }
  };

  const handleBack = () => {
    void navigate({
      to: "/p/$projectId/rank-tracking",
      params: { projectId },
    });
  };

  if (configs.isPending) {
    return (
      <div>
        <PageHeaderBand
          title={<Skeleton width={180} height={19} />}
          subtitle={<Skeleton width={320} />}
        />
        <div style={{ padding: "12px var(--pad,24px)" }} aria-busy>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} width="100%" style={{ marginBottom: 11 }} />
          ))}
        </div>
      </div>
    );
  }

  if (configs.isError) {
    return (
      <StateBand
        action={
          <SecondaryButton onClick={() => void configs.refetch()}>
            Try again
          </SecondaryButton>
        }
      >
        Could not load this domain&apos;s tracking configuration.
      </StateBand>
    );
  }

  if (!config) {
    return (
      <StateBand
        action={
          <SecondaryButton onClick={handleBack}>
            Back to domains
          </SecondaryButton>
        }
      >
        This tracking configuration no longer exists.
      </StateBand>
    );
  }

  return (
    <RankTrackingDomainDetail
      config={config}
      projectId={projectId}
      onBack={handleBack}
      onEdit={() => setShowConfigPanel((current) => !current)}
      // A band under the screen header rather than an overlay: the settings
      // being edited and the table they govern stay visible together.
      configPanel={
        showConfigPanel ? (
          <RankTrackingConfigPanel
            projectId={projectId}
            existingConfig={config}
            onClose={() => setShowConfigPanel(false)}
            onSaved={() => {
              setShowConfigPanel(false);
              invalidateConfigs();
            }}
          />
        ) : null
      }
    />
  );
}
