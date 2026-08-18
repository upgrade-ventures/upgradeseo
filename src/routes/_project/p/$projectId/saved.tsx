import { createFileRoute } from "@tanstack/react-router";
import { SavedPage } from "@/client/features/saved/SavedPage";

export const Route = createFileRoute("/_project/p/$projectId/saved")({
  component: SavedKeywordsRoute,
});

function SavedKeywordsRoute() {
  const { projectId } = Route.useParams();
  return <SavedPage projectId={projectId} />;
}
