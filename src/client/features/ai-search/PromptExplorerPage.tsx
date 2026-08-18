import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeaderBand,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import { explorePrompt } from "@/serverFunctions/ai-search";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AiVisibilityTabs,
  panelId,
  type AiVisibilityTabId,
} from "@/client/features/ai-search/components/AiVisibilityTabs";
import {
  ErrorPanel,
  InfoCallout,
} from "@/client/features/ai-search/components/aiControls";
import { InlineConfirm } from "@/client/features/ai-search/components/InlineConfirm";
import {
  PromptExplorerForm,
  type PromptExplorerErrors,
} from "@/client/features/ai-search/components/PromptExplorerForm";
import { PromptExplorerResults } from "@/client/features/ai-search/components/PromptExplorerResults";
import { PromptExplorerLoadingState } from "@/client/features/ai-search/components/PromptExplorerLoadingState";
import { PromptExplorerHistorySection } from "@/client/features/ai-search/components/PromptExplorerHistorySection";
import { usePromptExplorerSearchHistory } from "@/client/hooks/usePromptExplorerSearchHistory";
import {
  PROMPT_EXPLORER_MAX_PROMPT_LENGTH,
  type PromptExplorerModel,
  type WebSearchCountryCode,
} from "@/types/schemas/ai-search";

type PromptExplorerFormValues = {
  prompt: string;
  highlightBrand: string;
  models: PromptExplorerModel[];
  webSearch: boolean;
  webSearchCountryCode: WebSearchCountryCode;
};

type Props = {
  projectId: string;
  urlState: PromptExplorerFormValues;
  onSubmit: (values: PromptExplorerFormValues) => void;
  /** Drops the active prompt and returns the panel to recent prompts. */
  onClear: () => void;
  onSelectTab: (tab: AiVisibilityTabId) => void;
};

export function PromptExplorerPage(props: Props) {
  return <PromptExplorerPageInner {...props} />;
}

function PromptExplorerPageInner({
  projectId,
  urlState,
  onSubmit,
  onClear,
  onSelectTab,
}: Props) {
  const [form, setForm] = useState<PromptExplorerFormValues>(urlState);
  const [errors, setErrors] = useState<PromptExplorerErrors>({});
  // A prompt run is a job, so it states its scope and waits for a yes.
  const [pendingRun, setPendingRun] = useState<PromptExplorerFormValues | null>(
    null,
  );

  const {
    history,
    isLoaded: historyLoaded,
    addSearch,
    removeHistoryItem,
  } = usePromptExplorerSearchHistory(projectId);

  const trimmedPrompt = urlState.prompt.trim();
  const hasActivePrompt = trimmedPrompt.length > 0;

  const exploreQuery = useQuery({
    queryKey: [
      "prompt-explorer",
      projectId,
      trimmedPrompt,
      urlState.models.toSorted().join(","),
      urlState.webSearch,
      urlState.webSearchCountryCode,
      urlState.highlightBrand.trim(),
    ],
    queryFn: () =>
      explorePrompt({
        data: {
          projectId,
          prompt: trimmedPrompt,
          models: urlState.models,
          highlightBrand: urlState.highlightBrand.trim() || undefined,
          webSearch: urlState.webSearch,
          webSearchCountryCode: urlState.webSearchCountryCode,
        },
      }),
    enabled: hasActivePrompt && urlState.models.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Sync form to URL state: covers initial mount, browser back/forward, and
  // cmd+click history navigation (in the originating tab nothing changes; in
  // a new tab the form mounts populated from the URL).
  useEffect(() => {
    setForm(urlState);
    setErrors({});
  }, [urlState]);

  // Persist successful searches to history. Run on isSuccess so failed
  // requests don't pollute recent searches. The dedup ref prevents repeat
  // adds when downstream renders create new urlState references.
  const lastAddedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasActivePrompt || !exploreQuery.isSuccess) return;
    const key = [
      trimmedPrompt,
      urlState.highlightBrand.trim(),
      urlState.models.toSorted().join(","),
      urlState.webSearch,
      urlState.webSearchCountryCode,
    ].join("|");
    if (lastAddedKeyRef.current === key) return;
    lastAddedKeyRef.current = key;
    addSearch({
      prompt: trimmedPrompt,
      highlightBrand: urlState.highlightBrand.trim(),
      models: urlState.models,
      webSearch: urlState.webSearch,
      webSearchCountryCode: urlState.webSearchCountryCode,
    });
  }, [
    hasActivePrompt,
    exploreQuery.isSuccess,
    trimmedPrompt,
    urlState.highlightBrand,
    urlState.models,
    urlState.webSearch,
    urlState.webSearchCountryCode,
    addSearch,
  ]);

  // Messages name the fix, not the fault, per the design's validation rule.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = form.prompt.trim();
    const next: PromptExplorerErrors = {};

    if (trimmed.length === 0) {
      next.prompt = "Write the question you want an assistant to answer.";
    } else if (trimmed.length > PROMPT_EXPLORER_MAX_PROMPT_LENGTH) {
      next.prompt = `That is ${(trimmed.length - PROMPT_EXPLORER_MAX_PROMPT_LENGTH).toLocaleString()} characters over. Trim it to ${PROMPT_EXPLORER_MAX_PROMPT_LENGTH.toLocaleString()} or fewer.`;
    }
    if (form.models.length === 0) {
      next.models = "Pick at least one model to ask.";
    }

    setErrors(next);
    if (next.prompt || next.models) return;

    setPendingRun({
      ...form,
      prompt: trimmed,
      highlightBrand: form.highlightBrand.trim(),
    });
  };

  const errorMessage = exploreQuery.isError
    ? getStandardErrorMessage(exploreQuery.error)
    : null;
  const isLoading = hasActivePrompt && exploreQuery.isPending;
  const resultData = hasActivePrompt ? exploreQuery.data : undefined;

  const updateForm = <K extends keyof PromptExplorerFormValues>(
    key: K,
    value: PromptExplorerFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear only the message the edit could have fixed.
    setErrors((prev) => {
      const field = key === "models" ? "models" : "prompt";
      if (!prev[field]) return prev;
      return { ...prev, [field]: undefined };
    });
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      <PageHeaderBand
        title="AI Visibility"
        subtitle="Ask what your customers would ask, and read the answer back. Every answer here is written by our own Azure AI Foundry deployment."
        tabs={<AiVisibilityTabs active="prompts" onSelect={onSelectTab} />}
      />

      <div
        role="tabpanel"
        id={panelId("prompts")}
        aria-label="Prompt explorer"
        style={{ padding: "16px var(--pad, 24px)" }}
      >
        <PromptExplorerForm
          form={form}
          onPromptChange={(value) => updateForm("prompt", value)}
          onHighlightBrandChange={(value) =>
            updateForm("highlightBrand", value)
          }
          onModelsChange={(value) => updateForm("models", value)}
          onWebSearchChange={(value) => updateForm("webSearch", value)}
          onCountryChange={(value) => updateForm("webSearchCountryCode", value)}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          errors={errors}
        />

        {pendingRun ? (
          <InlineConfirm
            title={`Run this prompt on ${pendingRun.models.length} model${pendingRun.models.length === 1 ? "" : "s"}?`}
            // Scope is the model count and whether the run may search the web.
            // The seven-day hold is the honest statement about repeat runs; no
            // duration is claimed, because nothing here measures one.
            body={`We ask our own deployment ${pendingRun.models.length} time${pendingRun.models.length === 1 ? "" : "s"} and read each answer back${pendingRun.webSearch ? ", with web search allowed" : ", without web search"}. Each answer is kept for seven days, so re-running the same prompt inside that window returns what you already have.`}
            confirmLabel="Run prompt"
            onConfirm={() => {
              const values = pendingRun;
              setPendingRun(null);
              onSubmit(values);
            }}
            onCancel={() => setPendingRun(null)}
          />
        ) : null}

        <div style={{ marginTop: 12 }}>
          {errorMessage ? (
            <ErrorPanel
              message={errorMessage}
              onRetry={() => void exploreQuery.refetch()}
            />
          ) : isLoading ? (
            <PromptExplorerLoadingState />
          ) : resultData ? (
            <>
              <PromptExplorerResults result={resultData} />
              <div style={{ marginTop: 10 }}>
                <SecondaryButton onClick={onClear}>
                  Recent prompts
                </SecondaryButton>
              </div>
            </>
          ) : (
            <PromptExplorerHistorySection
              projectId={projectId}
              history={history}
              historyLoaded={historyLoaded}
              onRemoveHistoryItem={removeHistoryItem}
            />
          )}
        </div>

        <div style={{ maxWidth: 820, marginTop: 12 }}>
          <InfoCallout gutter={false}>
            Answers vary between runs, and this one is kept for seven days, so
            the same prompt returns the same answer for a week. The model
            buttons record what you asked for: we run one deployment of our own
            and never call ChatGPT, Claude, Gemini or Perplexity, so no answer
            here is labelled with their names.
          </InfoCallout>
        </div>
      </div>
    </div>
  );
}
