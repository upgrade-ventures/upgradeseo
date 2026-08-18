import { NoValue } from "@/client/components/prominence/Primitives";
import { SkeletonBar } from "@/client/features/ai-search/components/aiControls";
import { formatCount } from "@/client/features/ai-search/platformLabels";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

/**
 * The design's three headline stats: mention rate, average rank in the answer,
 * and the most-cited source.
 *
 * Only the first has a source here. Our measurement is a count of answers that
 * named the brand, taken from one model at one moment, and the probe count that
 * would turn it into a rate never reaches the client, so the cell reports the
 * count it actually has. Rank inside an answer is not extracted by any free
 * source, and our model answers without a web-search tool, so it cites nothing:
 * both cells say so rather than printing a zero we never measured.
 */
export function BrandLookupStatStrip({
  result,
}: {
  /** Null while the lookup is in flight. */
  result: BrandLookupResult | null;
}) {
  const loading = result == null;
  const citedSource = result ? topCitedDomain(result) : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <Cell
        divider
        label="Answers naming this brand"
        value={
          loading ? null : result.totalMentions == null ? (
            <NoValue />
          ) : (
            formatCount(result.totalMentions)
          )
        }
        caption={
          loading
            ? null
            : result.totalMentions == null
              ? "no measurement, see the note below"
              : "in our own model's category answers"
        }
      />
      <Cell
        divider
        label="Avg. rank in answer"
        value={loading ? null : <NoValue />}
        caption={loading ? null : "position in an answer is not extracted"}
      />
      <Cell
        label="Cited source"
        value={loading ? null : (citedSource ?? <NoValue />)}
        caption={
          loading
            ? null
            : citedSource
              ? "most cited domain in the sample"
              : "our model answers without web search"
        }
      />
    </div>
  );
}

function Cell({
  label,
  value,
  caption,
  divider,
}: {
  label: string;
  /** Null while loading. */
  value: React.ReactNode | null;
  caption: string | null;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "13px 20px",
        borderRight: divider ? "1px solid var(--border-muted)" : undefined,
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.01em",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {value ?? <SkeletonBar width={72} height={18} />}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
        {caption ?? <SkeletonBar width={110} height={10} />}
      </div>
    </div>
  );
}

/**
 * The domain cited by the most pages in the fetched sample. A mode over a real
 * list, never a guess: with no cited pages at all it returns null and the cell
 * reports the absence.
 */
function topCitedDomain(result: BrandLookupResult): string | null {
  const counts = new Map<string, number>();
  for (const page of result.topPages) {
    if (!page.domain) continue;
    counts.set(page.domain, (counts.get(page.domain) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [domain, count] of counts) {
    if (count > bestCount) {
      best = domain;
      bestCount = count;
    }
  }
  return best;
}
