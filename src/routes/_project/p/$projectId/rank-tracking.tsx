import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_project/p/$projectId/rank-tracking")({
  component: RankTrackingLayout,
});

// No wrapper: the design's screens are full-bleed inside the shell's scroll
// container and paint their own header band, so a page gutter here would
// double every screen's padding.
function RankTrackingLayout() {
  return <Outlet />;
}
