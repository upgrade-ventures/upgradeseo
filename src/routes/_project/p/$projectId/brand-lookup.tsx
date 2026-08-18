import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BrandLookupPage } from "@/client/features/ai-search/BrandLookupPage";
import { brandLookupSearchSchema } from "@/types/schemas/ai-search";

/**
 * `tab` is the design's AI Visibility tab. Two of its three tabs live on this
 * route, so the open one belongs in the URL: it keeps a competitor-share view
 * shareable and lets the Prompt Explorer route link straight back to it.
 */
const searchSchema = brandLookupSearchSchema.extend({
  tab: z.enum(["mentions", "share"]).optional(),
});

export const Route = createFileRoute("/_project/p/$projectId/brand-lookup")({
  validateSearch: searchSchema,
  component: BrandLookupRoute,
});

function BrandLookupRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  // `c` is already an opaque competitor string array via the schema transform.
  const { q = "", c = [], tab = "mentions" } = Route.useSearch();

  return (
    <BrandLookupPage
      projectId={projectId}
      initialQuery={q}
      initialCompetitors={c}
      tab={tab}
      onSearchChange={(nextQuery, nextCompetitors) => {
        void navigate({
          search: (prev) => ({
            ...prev,
            q: nextQuery.trim() || undefined,
            // One serialization site: comma-join the competitor list.
            c:
              nextCompetitors.length > 0
                ? nextCompetitors.join(",")
                : undefined,
          }),
          replace: true,
        });
      }}
      onSelectTab={(nextTab) => {
        if (nextTab === "prompts") {
          void navigate({
            to: "/p/$projectId/prompt-explorer",
            params: { projectId },
            search: {},
          });
          return;
        }
        void navigate({
          // The default tab stays out of the URL.
          search: (prev) => ({
            ...prev,
            tab: nextTab === "mentions" ? undefined : nextTab,
          }),
          replace: true,
        });
      }}
    />
  );
}
