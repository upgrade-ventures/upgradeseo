import { Card, ScreenBody } from "@/client/components/prominence/Primitives";
import { InfoCallout } from "@/client/features/ai-search/components/aiControls";
import { BrandLookupMentionTrendCard } from "@/client/features/ai-search/components/BrandLookupMentionTrendCard";
import { BrandLookupStatStrip } from "@/client/features/ai-search/components/BrandLookupStatStrip";
import { CitationTabsCard } from "@/client/features/ai-search/components/BrandLookupCitationsCard";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

type Props = {
  result: BrandLookupResult;
  projectId: string;
};

export function BrandLookupResults({ result, projectId }: Props) {
  return (
    <>
      <BrandLookupStatStrip result={result} />

      <MeasurementNote result={result} />

      {result.monthlyVolume.length > 0 ? (
        <ScreenBody>
          <Card title="Mention trend" note="last 12 months">
            <div style={{ padding: 12 }}>
              <BrandLookupMentionTrendCard result={result} />
            </div>
          </Card>
        </ScreenBody>
      ) : null}

      <CitationTabsCard result={result} projectId={projectId} />
    </>
  );
}

/**
 * What the headline number is, and what a missing one means.
 *
 * A lookup that produced no measurement and a lookup that measured zero
 * mentions are different results, and the schema keeps them apart: a null count
 * is "we never measured", a 0 is "we measured and the brand was never named".
 * Reporting either as the other would be the lie this screen exists to avoid.
 */
function MeasurementNote({ result }: { result: BrandLookupResult }) {
  const unmeasured = result.totalMentions == null;
  const measuredZero = result.totalMentions === 0;

  return (
    <>
      {unmeasured ? (
        <InfoCallout tone="warning">
          Our model produced no measurement for{" "}
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>
            {result.resolvedTarget}
          </strong>
          . It either does not recognise the brand, or cannot tell the name
          apart from the category questions asked about it. That is a limit of
          one model&apos;s training data, not evidence that the brand is absent
          from AI answers.
        </InfoCallout>
      ) : null}
      {measuredZero ? (
        <InfoCallout>
          Our model never named{" "}
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>
            {result.resolvedTarget}
          </strong>{" "}
          in its answers to the category questions we asked.
        </InfoCallout>
      ) : null}
      <InfoCallout>
        Measured by asking our own Azure AI Foundry deployment a set of category
        questions that never name the brand, then counting the answers that
        bring it up anyway. One model, one moment: it cannot show what ChatGPT
        or Google AI Overviews tell real users, or any trend over time.
      </InfoCallout>
    </>
  );
}
