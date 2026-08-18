import { createFileRoute } from "@tanstack/react-router";
import { CompetitorsPage } from "@/client/features/competitors/CompetitorsPage";

export const Route = createFileRoute("/_project/p/$projectId/competitors")({
  component: CompetitorsRoute,
});

function CompetitorsRoute() {
  const { projectId } = Route.useParams();
  return <CompetitorsPage projectId={projectId} />;
}
