import { linkOptions } from "@tanstack/react-router";
import type { IconName } from "@/client/components/icons/IconSprite";

const projectNavItems = [
  {
    to: "/p/$projectId" as const,
    label: "Dashboard",
    icon: "i-grid" satisfies IconName,
    // Without exact matching, the index path is a prefix of every project
    // route and the Dashboard item would render active everywhere.
    activeOptions: { exact: true, includeSearch: false },
  },
  {
    to: "/p/$projectId/keywords" as const,
    label: "Keyword Research",
    icon: "i-search" satisfies IconName,
  },
  {
    to: "/p/$projectId/saved" as const,
    label: "Saved Keywords",
    icon: "i-bookmark" satisfies IconName,
  },
  {
    to: "/p/$projectId/rank-tracking" as const,
    label: "Rank Tracking",
    icon: "i-trend" satisfies IconName,
  },
  {
    to: "/p/$projectId/search-performance" as const,
    label: "Search Performance",
    icon: "i-chart" satisfies IconName,
  },
  {
    to: "/p/$projectId/domain" as const,
    label: "Domain Overview",
    icon: "i-globe" satisfies IconName,
  },
  {
    to: "/p/$projectId/backlinks" as const,
    label: "Backlinks",
    icon: "i-link" satisfies IconName,
  },
  {
    to: "/p/$projectId/competitors" as const,
    label: "Competitors",
    icon: "i-swords" satisfies IconName,
  },
  {
    to: "/p/$projectId/audit" as const,
    label: "Site Audit",
    icon: "i-clipboard" satisfies IconName,
  },
  {
    to: "/p/$projectId/brand-lookup" as const,
    label: "Brand Lookup",
    icon: "i-sparkle" satisfies IconName,
  },
  {
    to: "/p/$projectId/prompt-explorer" as const,
    label: "Prompt Explorer",
    icon: "i-message" satisfies IconName,
  },
] as const;

const aiNavItem = linkOptions({
  to: "/ai" as const,
  label: "AI & MCP",
  icon: "i-plug" satisfies IconName,
});

// Always-visible sidebar group (not project-scoped, unlike the groups below).
export const connectNavGroup = {
  label: "Connect",
  items: [aiNavItem],
};

function getProjectNavItems(projectId: string) {
  return linkOptions(
    projectNavItems.map((item) => ({
      ...item,
      params: { projectId },
      search: {},
    })),
  );
}

// Grouped by scope: "My Site" is the project's own domain (tracked data),
// "Research" is point-at-anything lookup tools.
export function getProjectNavGroups(projectId: string) {
  const all = getProjectNavItems(projectId);
  const byPath = (path: (typeof projectNavItems)[number]["to"]) =>
    all.find((i) => i.to === path)!;

  return [
    {
      label: "Overview",
      items: [byPath("/p/$projectId")],
    },
    {
      label: "Research",
      items: [
        byPath("/p/$projectId/keywords"),
        byPath("/p/$projectId/domain"),
        byPath("/p/$projectId/backlinks"),
        byPath("/p/$projectId/competitors"),
        byPath("/p/$projectId/brand-lookup"),
        byPath("/p/$projectId/prompt-explorer"),
      ],
    },
    {
      label: "My Site",
      items: [
        byPath("/p/$projectId/search-performance"),
        byPath("/p/$projectId/rank-tracking"),
        byPath("/p/$projectId/saved"),
        byPath("/p/$projectId/audit"),
      ],
    },
  ];
}

// The DEFAULT setup path. UpgradeSEO runs on free sources, so new users are sent
// here first.
export const freeSetupHelpLinkOptions = linkOptions({
  to: "/help/free-setup",
});
