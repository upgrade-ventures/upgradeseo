import { Link } from "@tanstack/react-router";
import {
  HISTORY_ROW_STYLE,
  SearchHistorySection,
} from "@/client/features/ai-search/components/SearchHistorySection";
import type { BrandLookupSearchHistoryItem } from "@/client/hooks/useBrandLookupSearchHistory";

type Props = {
  projectId: string;
  history: BrandLookupSearchHistoryItem[];
  historyLoaded: boolean;
  onRemoveHistoryItem: (timestamp: number) => void;
};

export function BrandLookupHistorySection({ projectId, ...props }: Props) {
  return (
    <SearchHistorySection
      {...props}
      emptyIcon="i-sparkle"
      emptyMessage="Look up a brand or domain to see how AI answers name it."
      noun="lookup"
      renderItemLink={(item, content) => (
        <Link
          from="/p/$projectId/brand-lookup"
          to="/p/$projectId/brand-lookup"
          params={{ projectId }}
          search={{
            q: item.query,
            c:
              item.competitors.length > 0
                ? item.competitors.join(",")
                : undefined,
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
            {item.query}
          </span>
          {item.competitors.length > 0 ? (
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
              vs {item.competitors.join(", ")}
            </span>
          ) : null}
        </span>
      )}
    />
  );
}
