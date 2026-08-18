import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@/client/components/icons/IconSprite";
import {
  Card,
  InfoNote,
  ScreenBody,
} from "@/client/components/prominence/Primitives";
import { useFocusRing } from "./BacklinksDataTable";
import type { BacklinksSearchHistoryItem } from "@/client/hooks/useBacklinksSearchHistory";

type Props = {
  projectId: string;
  history: BacklinksSearchHistoryItem[];
  historyLoaded: boolean;
  onRemoveHistoryItem: (timestamp: number) => void;
};

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <button
      type="button"
      aria-label="Remove from recent searches"
      onClick={onRemove}
      {...focusProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        border: "none",
        borderRadius: 5,
        background: "none",
        color: "var(--text-3)",
        cursor: "pointer",
        ...focusStyle,
      }}
    >
      <Icon name="i-x" size={12} />
    </button>
  );
}

function HistoryRow({
  projectId,
  item,
  onRemove,
}: {
  projectId: string;
  item: BacklinksSearchHistoryItem;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 12px",
        borderBottom: "1px solid var(--border-muted)",
        background: hovered ? "var(--subtle)" : undefined,
      }}
    >
      <Link
        to="/p/$projectId/backlinks"
        params={{ projectId }}
        search={(prev) => ({
          ...prev,
          target: item.target,
          scope: item.scope,
          tab: undefined,
          page: undefined,
          sort: undefined,
          order: undefined,
        })}
        replace
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          flex: 1,
          minWidth: 0,
          color: "inherit",
          textDecoration: "none",
        }}
      >
        <Icon name="i-clock" size={13} style={{ color: "var(--text-3)" }} />
        <span
          style={{
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.target}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>
          {item.scope === "domain" ? "Site-wide" : "Exact page"}
        </span>
      </Link>
      <span
        style={{
          fontSize: 11.5,
          color: "var(--text-3)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {new Date(item.timestamp).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </span>
      <RemoveButton onRemove={onRemove} />
    </div>
  );
}

export function BacklinksHistorySection({
  projectId,
  history,
  historyLoaded,
  onRemoveHistoryItem,
}: Props) {
  if (!historyLoaded) return null;

  if (history.length === 0) {
    return (
      <ScreenBody>
        <Card>
          <div
            style={{
              padding: "34px 20px",
              textAlign: "center",
              color: "var(--text-2)",
            }}
          >
            <Icon
              name="i-link"
              size={22}
              style={{ color: "var(--text-3)", margin: "0 auto" }}
            />
            <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600 }}>
              Enter a domain or URL to see who links to it
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12.5,
                color: "var(--text-3)",
              }}
            >
              Link level data comes from Bing Webmaster Tools for sites verified
              in your own Bing account; authority comes from OpenPageRank.
            </p>
          </div>
        </Card>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <Card
        title="Recent searches"
        count={`${history.length} saved`}
        style={{ overflow: "hidden" }}
      >
        <div>
          {history.map((item) => (
            <HistoryRow
              key={item.timestamp}
              projectId={projectId}
              item={item}
              onRemove={() => onRemoveHistoryItem(item.timestamp)}
            />
          ))}
        </div>
      </Card>
      <InfoNote>Recent searches are kept in this browser only.</InfoNote>
    </ScreenBody>
  );
}
