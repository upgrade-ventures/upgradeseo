import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { RankTrackingDomainList } from "@/client/features/rank-tracking/RankTrackingDomainList";
import { RankTrackingConfigPanel } from "@/client/features/rank-tracking/RankTrackingConfigPanel";

export const Route = createFileRoute("/_project/p/$projectId/rank-tracking/")({
  component: RankTrackingIndex,
});

function RankTrackingIndex() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  const invalidateConfigs = () => {
    void queryClient.invalidateQueries({
      queryKey: ["rankTrackingConfigs", projectId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["rankTrackingConfigSummaries", projectId],
    });
  };

  return (
    <RankTrackingDomainList
      projectId={projectId}
      onAddDomain={() => setShowConfigPanel(true)}
      // The form is a band under the screen header, not an overlay, so the
      // domain table it adds to stays on screen while it is filled in.
      panel={
        showConfigPanel ? (
          <RankTrackingConfigPanel
            projectId={projectId}
            existingConfig={null}
            onClose={() => setShowConfigPanel(false)}
            onConfigCreated={invalidateConfigs}
            onSaved={(createdConfigId) => {
              setShowConfigPanel(false);
              invalidateConfigs();
              if (createdConfigId) {
                void navigate({
                  to: "/p/$projectId/rank-tracking/$configId",
                  params: { projectId, configId: createdConfigId },
                });
              }
            }}
          />
        ) : null
      }
    />
  );
}
