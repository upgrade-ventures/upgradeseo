import { Icon } from "@/client/components/icons/IconSprite";
import { MarkdownAnswer } from "@/client/features/ai-search/components/MarkdownAnswer";
import {
  formatRelative,
  MentionPill,
  StaticChip,
  useFocusRing,
} from "@/client/features/ai-search/components/aiControls";
import { formatUrlForDisplay } from "@/client/components/table/url";
import type {
  PromptExplorerCitation,
  PromptExplorerModelResult,
  PromptExplorerResult,
} from "@/types/schemas/ai-search";

/**
 * The design's answer card: a subtle header strip naming the answer and when it
 * was taken, then the answer itself, the ordered result chips and a "Cited:"
 * line.
 *
 * The design's chips rank the tools an answer named and highlight the own
 * brand. Nothing here extracts an ordered list of brands out of an answer, so
 * the card reports the one thing the server does measure: whether the brand
 * being looked for appears at all.
 */
export function PromptExplorerResults({
  result,
}: {
  result: PromptExplorerResult;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {result.results.map((modelResult) => (
        <AnswerCard
          key={modelResult.model}
          modelResult={modelResult}
          highlightBrand={result.highlightBrand}
          fetchedAt={result.fetchedAt}
        />
      ))}
    </div>
  );
}

function AnswerCard({
  modelResult,
  highlightBrand,
  fetchedAt,
}: {
  modelResult: PromptExplorerModelResult;
  highlightBrand: string | null;
  fetchedAt: string;
}) {
  const failed = modelResult.status === "error";

  return (
    <article
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        overflow: "hidden",
        maxWidth: 820,
        background: "var(--surface)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          padding: "9px 12px",
          background: "var(--subtle)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {failed ? "No answer" : "Answer"}
          </span>
          {/* Never the vendor the slot is named after: the answer comes from
              our own deployment, and captioning it "ChatGPT" would attribute it
              to a service we did not call. */}
          {!failed && modelResult.modelName ? (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              {modelResult.modelName}
            </span>
          ) : null}
          {!failed && modelResult.webSearch ? (
            <StaticChip>web search</StaticChip>
          ) : null}
          {!failed && highlightBrand && modelResult.brandMentioned != null ? (
            <MentionPill
              tone={modelResult.brandMentioned ? "mentioned" : "absent"}
            >
              {modelResult.brandMentioned
                ? `Names ${highlightBrand}`
                : `No mention of ${highlightBrand}`}
            </MentionPill>
          ) : null}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          {failed
            ? "the model did not answer"
            : `answered ${formatRelative(fetchedAt)}`}
          {!failed && modelResult.outputTokens != null
            ? ` · ${modelResult.outputTokens.toLocaleString()} tokens`
            : ""}
        </span>
      </header>

      {failed ? (
        <div
          role="alert"
          style={{
            padding: 12,
            fontSize: 12.5,
            lineHeight: 1.65,
            color: "var(--danger)",
          }}
        >
          {modelResult.message}
        </div>
      ) : (
        <div
          style={{
            padding: 12,
            fontSize: 12.5,
            lineHeight: 1.65,
            color: "var(--text-2)",
          }}
        >
          <MarkdownAnswer text={modelResult.text} />

          {modelResult.fanOutQueries.length > 0 ? (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                margin: "8px 0",
              }}
            >
              {modelResult.fanOutQueries.map((query) => (
                <StaticChip key={query}>{query}</StaticChip>
              ))}
            </div>
          ) : null}

          <CitedLine
            citations={modelResult.citations}
            webSearch={modelResult.webSearch}
          />
        </div>
      )}
    </article>
  );
}

function CitedLine({
  citations,
  webSearch,
}: {
  citations: PromptExplorerCitation[];
  webSearch: boolean;
}) {
  if (citations.length === 0) {
    return (
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-3)" }}>
        {webSearch
          ? "No sources cited in this answer."
          : "No cited sources: this answer came from training data, with no web search."}
      </p>
    );
  }

  return (
    <p style={{ margin: "8px 0 0", fontSize: 12 }}>
      Cited:{" "}
      {citations.map((citation, index) => (
        <span key={`${citation.url}-${index}`}>
          {index > 0 ? ", " : ""}
          <CitationLink citation={citation} />
        </span>
      ))}
    </p>
  );
}

function CitationLink({ citation }: { citation: PromptExplorerCitation }) {
  const { ring, ringProps } = useFocusRing();
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noreferrer"
      {...ringProps}
      style={{
        color: citation.matchedBrand ? "var(--accent)" : "var(--text-2)",
        fontWeight: citation.matchedBrand ? 600 : 400,
        borderRadius: 4,
        ...ring,
      }}
    >
      {citation.domain ?? formatUrlForDisplay(citation.url)}
      <Icon
        name="i-external"
        size={10}
        style={{ marginLeft: 3, verticalAlign: "baseline" }}
      />
    </a>
  );
}
