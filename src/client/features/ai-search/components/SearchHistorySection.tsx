import type { ReactNode } from "react";
import { Icon, type IconName } from "@/client/components/icons/IconSprite";
import { Card } from "@/client/components/prominence/Primitives";
import { useFocusRing } from "@/client/features/ai-search/components/aiControls";

type Props<TItem extends { timestamp: number }> = {
  history: TItem[];
  historyLoaded: boolean;
  onRemoveHistoryItem: (timestamp: number) => void;
  /**
   * Renders the clickable area of a history row. The caller is responsible
   * for wrapping `content` in a <Link> (or other clickable element) so that
   * cmd+click and right-click → "open in new tab" behave natively.
   */
  renderItemLink: (item: TItem, content: ReactNode) => ReactNode;
  /** Sprite icon shown in the empty state. */
  emptyIcon: IconName;
  /** Empty-state headline copy. */
  emptyMessage: string;
  /**
   * Label noun used in the "{n} recent {noun}(s)" header (e.g. "lookup",
   * "prompt"). Pluralization is handled by the component.
   */
  noun: string;
  /** Item body: primary (and optional secondary) text shown in each row. */
  renderItem: (item: TItem) => ReactNode;
};

/**
 * Recent searches, kept in local storage. The design has no empty state and no
 * history list; both are drawn out of its own vocabulary (card, subtle head
 * strip, muted caption) so a screen with nothing on it yet still explains
 * itself.
 */
export function SearchHistorySection<TItem extends { timestamp: number }>({
  history,
  historyLoaded,
  onRemoveHistoryItem,
  renderItemLink,
  emptyIcon,
  emptyMessage,
  noun,
  renderItem,
}: Props<TItem>) {
  if (!historyLoaded) return null;

  if (history.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "40px 12px",
          border: "1px dashed var(--border-strong)",
          borderRadius: 8,
          color: "var(--text-2)",
          textAlign: "center",
        }}
      >
        <Icon name={emptyIcon} size={22} style={{ color: "var(--text-3)" }} />
        <p style={{ margin: 0, fontSize: 12.5 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Card
      title="Recent"
      count={`${history.length} ${noun}${history.length === 1 ? "" : "s"}`}
    >
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {history.map((item, index) => (
          <li
            key={item.timestamp}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderBottom:
                index === history.length - 1
                  ? undefined
                  : "1px solid var(--border-muted)",
            }}
          >
            {renderItemLink(item, renderItem(item))}
            <span
              style={{
                fontSize: 11.5,
                color: "var(--text-3)",
                flexShrink: 0,
              }}
            >
              {new Date(item.timestamp).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <RemoveButton onClick={() => onRemoveHistoryItem(item.timestamp)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const { ring, ringProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove from history"
      {...ringProps}
      // Icon-only and 22px square, well under the 44px touch floor. A media
      // query cannot be written inline.
      className="max-sm:size-11"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        flexShrink: 0,
        border: "none",
        background: "none",
        borderRadius: 6,
        color: "var(--text-3)",
        cursor: "pointer",
        ...ring,
      }}
    >
      <Icon name="i-x" size={12} />
    </button>
  );
}

/** Shared by both history sections so their rows click alike. */
export const HISTORY_ROW_STYLE = {
  display: "flex",
  minWidth: 0,
  flex: 1,
  alignItems: "center",
  gap: 8,
  color: "inherit",
  padding: "2px 0",
} satisfies React.CSSProperties;
