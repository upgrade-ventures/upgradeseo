import { Tab, TabStrip } from "@/client/components/prominence/Primitives";

/**
 * The design draws AI Visibility as one screen with three tabs. In this app the
 * three live on two routes (Brand Lookup owns mentions + competitor share,
 * Prompt Explorer owns the prompt tester), each with its own URL state, so the
 * strip is shared and the page decides what a click means: a search-param
 * change on its own route, or a navigation to the other one.
 */

const AI_TABS = [
  { id: "mentions", label: "Brand mentions" },
  { id: "prompts", label: "Prompt explorer" },
  { id: "share", label: "Competitor share" },
] as const;

export type AiVisibilityTabId = (typeof AI_TABS)[number]["id"];

export function panelId(tab: AiVisibilityTabId): string {
  return `ai-panel-${tab}`;
}

export function AiVisibilityTabs({
  active,
  onSelect,
}: {
  active: AiVisibilityTabId;
  onSelect: (tab: AiVisibilityTabId) => void;
}) {
  return (
    <TabStrip>
      {AI_TABS.map((tab) => (
        <Tab
          key={tab.id}
          active={tab.id === active}
          onClick={() => onSelect(tab.id)}
          // Only the open panel is mounted, so only the selected tab has a live
          // element to point at.
          controls={tab.id === active ? panelId(tab.id) : undefined}
        >
          {tab.label}
        </Tab>
      ))}
    </TabStrip>
  );
}
