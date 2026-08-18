import { useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/client/components/icons/IconSprite";
import { MARKDOWN_COMPONENTS } from "@/client/components/Markdown";
import { useFocusRing } from "@/client/features/ai-search/components/aiControls";

type Props = {
  text: string;
};

/**
 * Collapsed-state max height in px. Roughly 9 lines of body text — enough
 * to convey the shape of an answer without dominating the page when four
 * models are stacked.
 */
const COLLAPSED_MAX_PX = 240;

/**
 * Render an LLM's markdown answer with explicit per-element Tailwind classes.
 *
 * Long answers collapse to ~12 lines with a fade-out gradient and a
 * "Read more" toggle so a side-by-side comparison of four models stays
 * scannable. We measure the rendered scroll height to decide whether the
 * toggle is needed.
 *
 * Anchor URLs are sanitized to http(s) only — LLMs can be coaxed into
 * emitting `javascript:` payloads.
 */
export function MarkdownAnswer({ text }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const { thinking, body } = extractThinkingBlocks(text);
  const normalized = normalizeLlmMarkdown(body);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // scrollHeight reflects natural content height even when overflow is
    // clipped by max-h, so we can detect overflow without toggling state.
    setNeedsCollapse(el.scrollHeight > COLLAPSED_MAX_PX + 8);
  }, [normalized]);

  if (normalized.trim().length === 0 && thinking.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          fontStyle: "italic",
          color: "var(--text-3)",
        }}
      >
        Model returned an empty response.
      </p>
    );
  }

  const isCollapsed = needsCollapse && !expanded;

  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.65 }}>
      {thinking.map((block, index) => (
        <ThinkingBlock key={index} text={block} />
      ))}

      {normalized.trim().length > 0 ? (
        <div style={{ position: "relative" }}>
          <div
            ref={contentRef}
            style={
              isCollapsed
                ? { maxHeight: COLLAPSED_MAX_PX, overflow: "hidden" }
                : undefined
            }
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={MARKDOWN_COMPONENTS}
            >
              {normalized}
            </ReactMarkdown>
          </div>

          {isCollapsed ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                insetInline: 0,
                bottom: 0,
                height: 64,
                pointerEvents: "none",
                // The card this sits in is painted --surface, so the fade has
                // to land on --surface rather than on a DaisyUI base colour.
                background:
                  "linear-gradient(to top, var(--surface), transparent)",
              }}
            />
          ) : null}
        </div>
      ) : null}

      {needsCollapse ? (
        <ReadMoreToggle
          expanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
        />
      ) : null}
    </div>
  );
}

function ReadMoreToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const { ring, ringProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      {...ringProps}
      // The only control on a long answer, so it has to clear the 44px touch
      // floor. A media query cannot be written inline.
      className="max-sm:min-h-11"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        marginTop: 8,
        padding: "2px 4px",
        marginInlineStart: -4,
        border: "none",
        background: "none",
        borderRadius: 5,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--accent)",
        cursor: "pointer",
        ...ring,
      }}
    >
      <Icon name={expanded ? "i-chev-down" : "i-chev-right"} size={13} />
      {expanded ? "Show less" : "Read more"}
    </button>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  return (
    <details
      open
      style={{
        marginBottom: 12,
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--subtle)",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 12px",
          listStyle: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-2)",
        }}
      >
        <Icon name="i-chev-down" size={13} />
        Model thinking
      </summary>
      <pre
        style={{
          margin: 0,
          padding: "9px 12px",
          borderTop: "1px solid var(--line)",
          background: "var(--inset)",
          // One UI sans stack across the product: the design ships no
          // monospace, and a <pre> would otherwise inherit the browser's.
          fontFamily: "inherit",
          fontSize: 12,
          color: "var(--text-2)",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          overflowX: "auto",
        }}
      >
        {text}
      </pre>
    </details>
  );
}

/**
 * Reasoning models (e.g. Perplexity sonar-reasoning-pro) wrap their chain of
 * thought in `<think>...</think>` tags inline with the answer. Pull those out
 * so we can render them in a separate, collapsible block.
 *
 * Tolerates an unclosed final `<think>` (e.g. from a truncated stream) by
 * treating everything after it as a thinking block.
 */
function extractThinkingBlocks(text: string): {
  thinking: string[];
  body: string;
} {
  const thinking: string[] = [];
  let body = text;

  body = body.replace(/<think>([\s\S]*?)<\/think>/gi, (_, inner: string) => {
    thinking.push(inner.trim());
    return "";
  });

  body = body.replace(/<think>([\s\S]*)$/i, (_, inner: string) => {
    thinking.push(inner.trim());
    return "";
  });

  return { thinking, body };
}

/**
 * Fix a class of malformed markdown we see from LLM responses: a list marker
 * (`-`, `*`, `+`, or `1.`) on a line by itself, followed by a blank line,
 * followed by the actual item content as a separate paragraph. Default
 * markdown correctly renders that as an empty bullet + detached paragraph,
 * which looks broken. Collapse the blank line so the marker and content
 * form a proper list item.
 */
function normalizeLlmMarkdown(text: string): string {
  return text.replace(
    /^([ \t]*)([-*+]|\d+\.)[ \t]*\r?\n[ \t]*\r?\n(?=\S)(?![ \t]*(?:[-*+]|\d+\.)[ \t])/gm,
    "$1$2 ",
  );
}
