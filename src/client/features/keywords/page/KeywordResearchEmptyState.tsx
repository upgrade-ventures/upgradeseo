import { Link } from "@tanstack/react-router";
import { Icon } from "@/client/components/icons/IconSprite";
import {
  Card,
  InfoNote,
  ScreenBody,
} from "@/client/components/prominence/Primitives";
import { LOCATIONS } from "@/client/features/keywords/utils";
import { GhostButton, useFocusRing } from "./prominenceControls";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
  projectId: string;
};

export function KeywordResearchEmptyState({ controller, projectId }: Props) {
  const { hasSearched, isLoading, lastSearchError } = controller;

  if (hasSearched && !isLoading && !lastSearchError) {
    return <NoResultsState controller={controller} />;
  }

  return <SearchHistoryState controller={controller} projectId={projectId} />;
}

/** Re-runs a stored search. Carries the token focus ring, like every control. */
function HistoryLink({
  projectId,
  keyword,
  locationCode,
  label,
}: {
  projectId: string;
  keyword: string;
  locationCode: number;
  label: string;
}) {
  const { ring, ringProps } = useFocusRing();

  return (
    <Link
      from="/p/$projectId/keywords"
      to="/p/$projectId/keywords"
      params={{ projectId }}
      search={{ q: keyword, loc: locationCode }}
      replace
      {...ringProps}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        minHeight: "max(20px, var(--tap, 0px))",
        fontSize: 12.5,
        fontWeight: 600,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        borderRadius: 4,
        ...ring,
      }}
    >
      {label}
    </Link>
  );
}

function NoResultsState({
  controller,
}: {
  controller: KeywordResearchControllerState;
}) {
  const { lastSearchKeyword, lastSearchLocationCode } = controller;

  return (
    <ScreenBody>
      <Card title="No keywords returned">
        <div style={{ padding: "14px 12px" }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
            {`Nothing came back for "${lastSearchKeyword}" in ${
              LOCATIONS[lastSearchLocationCode] ?? "this location"
            }.`}
          </p>
          <InfoNote>
            Try a broader seed term, or switch the match mode. No figures are
            shown here because none were reported, not because they are zero.
          </InfoNote>
        </div>
      </Card>
    </ScreenBody>
  );
}

function SearchHistoryState({
  controller,
  projectId,
}: {
  controller: KeywordResearchControllerState;
  projectId: string;
}) {
  const { history, historyLoaded, removeHistoryItem } = controller;

  if (!historyLoaded) return null;

  if (history.length === 0) {
    return (
      <ScreenBody>
        <Card>
          <div style={{ padding: "28px 16px", textAlign: "center" }}>
            <Icon
              name="i-search"
              size={22}
              style={{ color: "var(--text-3)" }}
            />
            <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600 }}>
              Enter a keyword to get started
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12.5,
                color: "var(--text-2)",
              }}
            >
              Search any term to see volume, CPC and related keyword ideas.
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
        count={`${history.length}`}
        note="Stored on this device"
      >
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {history.map((item) => (
            <li
              key={item.timestamp}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderTop: "1px solid var(--border-muted)",
              }}
            >
              <Icon
                name="i-clock"
                size={13}
                style={{ color: "var(--text-3)", flexShrink: 0 }}
              />
              <HistoryLink
                projectId={projectId}
                keyword={item.keyword}
                locationCode={item.locationCode}
                label={`${item.keyword} ${item.locationName}`}
              />
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--text-3)",
                  whiteSpace: "nowrap",
                }}
              >
                {new Date(item.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <GhostButton
                aria-label={`Remove ${item.keyword} from recent searches`}
                onClick={() => removeHistoryItem(item.timestamp)}
              >
                <Icon name="i-x" size={12} />
              </GhostButton>
            </li>
          ))}
        </ul>
      </Card>
    </ScreenBody>
  );
}
