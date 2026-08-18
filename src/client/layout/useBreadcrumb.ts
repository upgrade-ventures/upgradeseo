import { useLocation } from "@tanstack/react-router";
import {
  connectNavGroup,
  getProjectNavGroups,
} from "@/client/navigation/items";

/**
 * The current screen's label, for the topbar breadcrumb.
 *
 * Derived from the nav model rather than a second lookup table: the design ships
 * its own CRUMBS map, but duplicating it here would let the sidebar and the
 * breadcrumb drift apart the first time a label changes. One source of truth.
 *
 * Matching is longest-path-first so `/p/x/rank-tracking/acme.com` resolves to
 * "Rank Tracking" rather than to the project index, whose path is a prefix of
 * every project route.
 */
export function useBreadcrumb(projectId: string | null): string | null {
  const { pathname } = useLocation();

  const items = [
    ...(projectId
      ? getProjectNavGroups(projectId).flatMap((g) => g.items)
      : []),
    ...connectNavGroup.items,
  ];

  let best: { label: string; length: number } | null = null;
  for (const item of items) {
    const path = resolvePath(item.to, projectId);
    if (path === null) continue;
    const matches = pathname === path || pathname.startsWith(`${path}/`);
    if (!matches) continue;
    if (best === null || path.length > best.length) {
      best = { label: item.label, length: path.length };
    }
  }

  return best?.label ?? null;
}

/** Substitute the one route param the nav uses. */
function resolvePath(to: string, projectId: string | null): string | null {
  if (!to.includes("$projectId")) return to;
  if (projectId === null) return null;
  return to.replace("$projectId", projectId);
}
