import { Link } from "@tanstack/react-router";
import {
  HISTORY_ROW_STYLE,
  SearchHistorySection,
} from "@/client/features/ai-search/components/SearchHistorySection";
import { formatModelLabel } from "@/client/features/ai-search/platformLabels";
import type { PromptExplorerSearchHistoryItem } from "@/client/hooks/usePromptExplorerSearchHistory";

type Props = {
  projectId: string;
  history: PromptExplorerSearchHistoryItem[];
  historyLoaded: boolean;
  onRemoveHistoryItem: (timestamp: number) => void;
};

export function PromptExplorerHistorySection({ projectId, ...props }: Props) {
  return (
    <SearchHistorySection
      {...props}
      emptyIcon="i-message"
      emptyMessage="Ask a prompt to see how an AI answer names the brands in your category."
      noun="prompt"
      renderItemLink={(item, content) => (
        <Link
          from="/p/$projectId/prompt-explorer"
          to="/p/$projectId/prompt-explorer"
          params={{ projectId }}
          search={{
            q: item.prompt,
            models: item.models,
            web: item.webSearch ? undefined : false,
            cc:
              item.webSearchCountryCode === "US"
                ? undefined
                : item.webSearchCountryCode,
            hb: item.highlightBrand || undefined,
          }}
          replace
          style={HISTORY_ROW_STYLE}
        >
          {content}
        </Link>
      )}
      renderItem={(item) => (
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
            {item.prompt}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 11.5,
              color: "var(--text-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.models.map(formatModelLabel).join(", ")}
          </span>
        </span>
      )}
    />
  );
}
