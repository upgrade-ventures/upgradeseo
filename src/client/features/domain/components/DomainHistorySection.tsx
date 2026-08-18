import { Icon } from "@/client/components/icons/IconSprite";
import { Card } from "@/client/components/prominence/Primitives";
import { focusRing } from "@/client/features/domain/components/domainTableStyles";
import type { DomainHistoryItem } from "@/client/features/domain/types";

type Props = {
  history: DomainHistoryItem[];
  historyLoaded: boolean;
  onRemoveHistoryItem: (timestamp: number) => void;
  onSelectHistoryItem: (item: DomainHistoryItem) => void;
};

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

/**
 * What the screen shows before a domain is chosen: the lookups this browser has
 * made for this project. Stored locally, so it is genuinely the user's own
 * history rather than a sample list.
 */
export function DomainHistorySection({
  history,
  historyLoaded,
  onRemoveHistoryItem,
  onSelectHistoryItem,
}: Props) {
  if (!historyLoaded) return null;

  if (history.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "42px 20px",
          border: "1px dashed var(--line)",
          borderRadius: 8,
          background: "var(--subtle)",
          textAlign: "center",
        }}
      >
        <span style={{ color: "var(--text-3)", display: "flex" }}>
          <Icon name="i-globe" size={22} />
        </span>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
          Enter a domain to get started
        </p>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
          Look up any site to see the keywords it targets and the pages it
          publishes.
        </p>
      </div>
    );
  }

  return (
    <Card
      title="Recent lookups"
      count={`${history.length} saved on this device`}
    >
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {history.map((item, index) => (
          <li
            key={item.timestamp}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px var(--pad, 24px) 6px 12px",
              borderTop:
                index === 0 ? undefined : "1px solid var(--border-muted)",
            }}
          >
            <button
              type="button"
              onClick={() => onSelectHistoryItem(item)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                flex: 1,
                minWidth: 0,
                padding: "3px 4px",
                border: "none",
                background: "none",
                borderRadius: 5,
                outline: "none",
                textAlign: "left",
                font: "inherit",
                color: "inherit",
                cursor: "pointer",
              }}
              {...focusRing<HTMLButtonElement>()}
            >
              <span style={{ color: "var(--text-3)", display: "flex" }}>
                <Icon name="i-clock" size={13} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.domain}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    color: "var(--text-2)",
                  }}
                >
                  {item.subdomains
                    ? "Including subdomains"
                    : "Root domain only"}
                </span>
              </span>
            </button>

            <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
              {new Date(item.timestamp).toLocaleDateString(
                undefined,
                DAY_FORMAT,
              )}
            </span>

            <button
              type="button"
              onClick={() => onRemoveHistoryItem(item.timestamp)}
              aria-label={`Remove ${item.domain} from recent lookups`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                border: "none",
                background: "none",
                borderRadius: 5,
                outline: "none",
                color: "var(--text-3)",
                cursor: "pointer",
              }}
              {...focusRing<HTMLButtonElement>()}
            >
              <Icon name="i-x" size={12} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
