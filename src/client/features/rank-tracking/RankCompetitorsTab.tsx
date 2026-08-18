import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import { getCompetitors } from "@/serverFunctions/competitors";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";
import {
  Dash,
  HEAD_ROW,
  HoverRow,
  InfoDotNote,
  Skeleton,
  StateBand,
  TABLE,
  TABLE_SCROLLER,
  TD_GUTTER,
  TD_VALUE,
  TH_GUTTER,
  TH_VALUE,
} from "./RankScreenParts";
import { formatCount } from "./rankFormat";

/**
 * The Competitors tab.
 *
 * The design compares positions per competitor domain. Nothing in the free
 * stack returns another site's position for a keyword: our checks read Search
 * Console and Bing Webmaster for domains the user has verified, and neither
 * says anything about anyone else. So the two comparison columns state that
 * they are unmeasured rather than showing a number nobody measured.
 *
 * "Shared keywords" IS measurable, from a different source and only as far as
 * that source reaches: how many tracked keywords appear in the pages Common
 * Crawl has for that competitor. The column title says so.
 */
export function RankCompetitorsTab({
  projectId,
  domain,
  rows,
  avgPosition,
}: {
  projectId: string;
  domain: string;
  rows: RankTrackingRow[];
  avgPosition: number | null;
}) {
  const competitors = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => getCompetitors({ data: { projectId } }),
  });

  const trackedKeywords = useMemo(
    () => rows.map((row) => row.keyword.toLowerCase().trim()).filter(Boolean),
    [rows],
  );

  const compared = useMemo(() => {
    return (competitors.data ?? [])
      .map((competitor) => ({
        id: competitor.id,
        domain: competitor.domain,
        // Not harvested (or the crawl had nothing) means the overlap is
        // unknown, which is not the same as an overlap of zero.
        overlap:
          competitor.harvestedAt && !competitor.unavailable
            ? countOverlap(trackedKeywords, competitor.phrases)
            : null,
      }))
      .toSorted((a, b) => (b.overlap ?? -1) - (a.overlap ?? -1));
  }, [competitors.data, trackedKeywords]);

  if (competitors.isError) {
    return (
      <StateBand
        action={
          <SecondaryButton onClick={() => void competitors.refetch()}>
            Try again
          </SecondaryButton>
        }
      >
        Could not load this project&apos;s competitors.
      </StateBand>
    );
  }

  if (competitors.isPending) {
    return (
      <div style={{ padding: "12px var(--pad,24px)" }} aria-busy>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} width="100%" style={{ marginBottom: 9 }} />
        ))}
      </div>
    );
  }

  if (compared.length === 0) {
    return (
      <StateBand
        action={
          <Link
            to="/p/$projectId/competitors"
            params={{ projectId }}
            className="prominence-button-secondary"
          >
            Add competitors
          </Link>
        }
      >
        No competitor domains are tracked for this project yet.
      </StateBand>
    );
  }

  return (
    <>
      <div style={TABLE_SCROLLER}>
        <table style={TABLE}>
          <thead>
            <tr style={HEAD_ROW}>
              <th style={TH_GUTTER}>Domain</th>
              <th
                style={TH_VALUE}
                title="Tracked keywords that appear in this competitor's crawled pages (Common Crawl)"
              >
                Shared keywords
              </th>
              <th style={TH_VALUE}>Ahead of you on</th>
              <th style={TH_VALUE}>Avg position</th>
            </tr>
          </thead>
          <tbody>
            {compared.map((competitor) => (
              <HoverRow key={competitor.id}>
                <td style={TD_GUTTER}>{competitor.domain}</td>
                <td
                  style={{
                    ...TD_VALUE,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {competitor.overlap === null ? (
                    <span title="This competitor has not been harvested yet">
                      <Dash />
                    </span>
                  ) : (
                    formatCount(competitor.overlap)
                  )}
                </td>
                <td style={TD_VALUE}>
                  <span title="No free source reports another domain's position">
                    <Dash />
                  </span>
                </td>
                <td style={TD_VALUE}>
                  <span title="No free source reports another domain's position">
                    <Dash />
                  </span>
                </td>
              </HoverRow>
            ))}
            <HoverRow>
              <td style={TD_GUTTER}>{domain}</td>
              <td style={TD_VALUE}>
                <Dash />
              </td>
              <td style={TD_VALUE}>
                <Dash />
              </td>
              <td
                style={{ ...TD_VALUE, fontVariantNumeric: "tabular-nums" }}
                title="Your average position across the keywords that currently rank"
              >
                {avgPosition === null ? <Dash /> : avgPosition.toFixed(1)}
              </td>
            </HoverRow>
          </tbody>
        </table>
      </div>

      <InfoDotNote align="top" style={{ margin: "14px var(--pad,24px)" }}>
        Positions are only measured for domains you have verified, so the
        comparison columns stay empty for competitors. Shared keywords counts
        tracked keywords found in the competitor pages Common Crawl holds — a
        footprint overlap, not a ranking comparison.
      </InfoDotNote>
    </>
  );
}

function countOverlap(
  trackedKeywords: string[],
  phrases: { phrase: string }[],
): number {
  const haystack = phrases.map((entry) => entry.phrase.toLowerCase());
  return trackedKeywords.filter((keyword) =>
    haystack.some((phrase) => phrase.includes(keyword)),
  ).length;
}
