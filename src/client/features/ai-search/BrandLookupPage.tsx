import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeaderBand,
  ScreenBody,
} from "@/client/components/prominence/Primitives";
import { lookupBrand } from "@/serverFunctions/ai-search";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AiVisibilityTabs,
  panelId,
  type AiVisibilityTabId,
} from "@/client/features/ai-search/components/AiVisibilityTabs";
import {
  ErrorPanel,
  formatRelative,
} from "@/client/features/ai-search/components/aiControls";
import { BrandLookupResults } from "@/client/features/ai-search/components/BrandLookupResults";
import {
  BrandLookupSearchCard,
  type LookupValidationError,
} from "@/client/features/ai-search/components/BrandLookupSearchCard";
import { BrandLookupShareOfVoice } from "@/client/features/ai-search/components/BrandLookupShareOfVoice";
import { BrandLookupHistorySection } from "@/client/features/ai-search/components/BrandLookupHistorySection";
import { AiSearchLoadingState } from "@/client/features/ai-search/components/AiSearchLoadingState";
import { useBrandLookupSearchHistory } from "@/client/hooks/useBrandLookupSearchHistory";
import {
  BRAND_LOOKUP_MAX_INPUT_LENGTH,
  parseCompetitorList,
} from "@/types/schemas/ai-search";
import { detectTarget } from "@/shared/targetDetection";

type Props = {
  projectId: string;
  initialQuery: string;
  initialCompetitors: string[];
  /** Which of the two tabs this route owns is open. */
  tab: "mentions" | "share";
  onSearchChange: (nextQuery: string, nextCompetitors: string[]) => void;
  onSelectTab: (tab: AiVisibilityTabId) => void;
};

/** The Share of Voice comparison caps at five, matching the input schema. */
const MAX_COMPETITORS = 5;

/**
 * The one rule set for the lookup form.
 *
 * Called on blur by each field and again on submit, so a message a field shows
 * is the same message the button would give. Every message names the fix, per
 * the Forms & validation rule, rather than only naming the fault.
 */
function validateLookup(
  rawQuery: string,
  rawCompetitors: string,
): LookupValidationError | null {
  const trimmed = rawQuery.trim();
  if (trimmed.length === 0) {
    return { field: "query", message: "Enter a brand name or domain." };
  }
  if (trimmed.length > BRAND_LOOKUP_MAX_INPUT_LENGTH) {
    return {
      field: "query",
      message: `That is ${(trimmed.length - BRAND_LOOKUP_MAX_INPUT_LENGTH).toLocaleString()} characters over. Trim it to ${BRAND_LOOKUP_MAX_INPUT_LENGTH} or fewer.`,
    };
  }

  const competitors = parseCompetitorList(rawCompetitors);
  // Mirror the server's input schema (per-item max) and its competitor
  // resolution (a competitor that resolves to the target is dropped) so the
  // user gets an inline message instead of a generic server error or a
  // silently missing Share of Voice section.
  const tooLong = competitors.find(
    (competitor) => competitor.length > BRAND_LOOKUP_MAX_INPUT_LENGTH,
  );
  if (tooLong) {
    return {
      field: "competitors",
      message: `Shorten "${tooLong}": each competitor has to be ${BRAND_LOOKUP_MAX_INPUT_LENGTH} characters or fewer.`,
    };
  }

  // `parseCompetitorList` caps the list silently, so a sixth entry would vanish
  // without the user ever being told. Count the raw entries and say so.
  const entered = new Set(
    rawCompetitors
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  ).size;
  if (entered > MAX_COMPETITORS) {
    return {
      field: "competitors",
      message: `Remove ${entered - MAX_COMPETITORS}: up to ${MAX_COMPETITORS} competitors are compared in one lookup.`,
    };
  }

  const targetValue = detectTarget(trimmed).value.toLowerCase();
  const matchesTarget = competitors.find(
    (competitor) =>
      detectTarget(competitor).value.toLowerCase() === targetValue,
  );
  if (matchesTarget) {
    return {
      field: "competitors",
      message: `Remove "${matchesTarget}": it matches the brand you are looking up.`,
    };
  }

  return null;
}

export function BrandLookupPage(props: Props) {
  return <BrandLookupPageInner {...props} />;
}

function BrandLookupPageInner({
  projectId,
  initialQuery,
  initialCompetitors,
  tab,
  onSearchChange,
  onSelectTab,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  // Raw comma-separated competitor text; parsed into a deduped array on submit.
  const [competitorsInput, setCompetitorsInput] = useState(
    initialCompetitors.join(", "),
  );
  // Field-tagged so the error styling lands on the input that caused it.
  const [validationError, setValidationError] =
    useState<LookupValidationError | null>(null);

  const trimmedInitialQuery = initialQuery.trim();
  const hasActiveQuery = trimmedInitialQuery.length > 0;
  // The URL `c` param is the source of truth for the active lookup; the local
  // `competitorsInput` text only drives the input until the next submit. A
  // stable string key, since `initialCompetitors` is a fresh array each render.
  const competitorKey = initialCompetitors.join(",");

  const lookupQuery = useQuery({
    queryKey: ["brand-lookup", projectId, trimmedInitialQuery, competitorKey],
    queryFn: () =>
      lookupBrand({
        data: {
          projectId,
          query: trimmedInitialQuery,
          competitors: initialCompetitors,
          locationCode: 2840,
          languageCode: "en",
        },
      }),
    enabled: hasActiveQuery,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const {
    history,
    isLoaded: historyLoaded,
    addSearch,
    removeHistoryItem,
  } = useBrandLookupSearchHistory(projectId);

  // Dedup ref prevents repeat adds: `addSearch` identity is not stable
  // across renders, so we'd otherwise re-write the same item every render.
  // Key on query + competitors so changing competitors records a fresh entry.
  const lastAddedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasActiveQuery || !lookupQuery.isSuccess) return;
    const addedKey = `${trimmedInitialQuery}::${competitorKey}`;
    if (lastAddedKeyRef.current === addedKey) return;
    lastAddedKeyRef.current = addedKey;
    addSearch({
      query: trimmedInitialQuery,
      competitors: competitorKey ? competitorKey.split(",") : [],
    });
  }, [
    hasActiveQuery,
    lookupQuery.isSuccess,
    trimmedInitialQuery,
    competitorKey,
    addSearch,
  ]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const failure = validateLookup(query, competitorsInput);
    setValidationError(failure);
    if (failure) return;
    onSearchChange(query.trim(), parseCompetitorList(competitorsInput));
  };

  // The form inputs are reset whenever the URL `q`/`c` changes, including the
  // browser-back path and Cmd+click navigation. This keeps local form state in
  // sync with the URL source-of-truth. Depend on the stable `competitorKey`
  // string (not the fresh-each-render `initialCompetitors` array) so typing in
  // the competitor field isn't clobbered on every render.
  useEffect(() => {
    setQuery(initialQuery);
    setCompetitorsInput(competitorKey.split(",").join(", "));
    setValidationError(null);
  }, [initialQuery, competitorKey]);

  const isLoading = hasActiveQuery && lookupQuery.isPending;
  const errorMessage =
    hasActiveQuery && lookupQuery.isError
      ? getStandardErrorMessage(lookupQuery.error)
      : null;
  const result = hasActiveQuery ? lookupQuery.data : undefined;

  return (
    <div style={{ paddingBottom: 48 }}>
      <PageHeaderBand
        title="AI Visibility"
        subtitle={
          <>
            How often AI answers name a brand. We ask our own Azure AI Foundry
            deployment a set of category questions that never name it, then
            count the answers that bring it up anyway.
            {result
              ? ` Measured for ${result.resolvedTarget} ${formatRelative(result.fetchedAt)}.`
              : ""}
          </>
        }
        tabs={<AiVisibilityTabs active={tab} onSelect={onSelectTab} />}
      />

      <div style={{ borderBottom: "1px solid var(--line)" }}>
        <BrandLookupSearchCard
          query={query}
          onQueryChange={(next) => {
            setQuery(next);
            if (validationError) setValidationError(null);
          }}
          competitors={competitorsInput}
          onCompetitorsChange={(next) => {
            setCompetitorsInput(next);
            if (validationError) setValidationError(null);
          }}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          validationError={validationError}
          validate={validateLookup}
          onClear={hasActiveQuery ? () => onSearchChange("", []) : undefined}
        />
      </div>

      <div
        role="tabpanel"
        id={panelId(tab)}
        aria-label={tab === "mentions" ? "Brand mentions" : "Competitor share"}
      >
        {errorMessage ? (
          <ScreenBody>
            <ErrorPanel
              message={errorMessage}
              onRetry={() => void lookupQuery.refetch()}
            />
          </ScreenBody>
        ) : isLoading ? (
          <AiSearchLoadingState withStats={tab === "mentions"} />
        ) : result ? (
          tab === "mentions" ? (
            <BrandLookupResults result={result} projectId={projectId} />
          ) : (
            <BrandLookupShareOfVoice
              shareOfVoice={result.shareOfVoice}
              resolvedTarget={result.resolvedTarget}
              hasCompetitors={initialCompetitors.length > 0}
            />
          )
        ) : (
          <ScreenBody>
            <BrandLookupHistorySection
              projectId={projectId}
              history={history}
              historyLoaded={historyLoaded}
              onRemoveHistoryItem={removeHistoryItem}
            />
          </ScreenBody>
        )}
      </div>
    </div>
  );
}
