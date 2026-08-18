import { useMemo } from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import type { RankPositionMatrixCell } from "@/serverFunctions/rank-tracking";
import {
  HEAD_ROW,
  HoverRow,
  Skeleton,
  StateBand,
  TABLE,
  TABLE_SCROLLER,
  TD_GUTTER,
  TD_VALUE,
  TH_GUTTER,
  TH_VALUE,
} from "./RankScreenParts";
import { formatDay } from "./rankFormat";

/**
 * Keyword rows against completed checks, newest check first.
 *
 * A cell is the position that check recorded. An empty cell is an absence of
 * data, which the note under the table spells out — it is never rendered as a
 * position, and never as a zero.
 */
export function RankTrackingHistoryMatrix({
  cells,
  keywords,
  isLoading,
  isError,
  onRetry,
}: {
  cells: RankPositionMatrixCell[];
  keywords: { trackingKeywordId: string; keyword: string }[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { runs, byKeyword } = useMemo(() => buildMatrix(cells), [cells]);

  if (isError) {
    return (
      <StateBand
        action={<SecondaryButton onClick={onRetry}>Try again</SecondaryButton>}
      >
        Could not load the check history for this domain.
      </StateBand>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: "12px var(--pad,24px)" }} aria-busy>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} width="100%" style={{ marginBottom: 9 }} />
        ))}
      </div>
    );
  }

  if (runs.length === 0 || keywords.length === 0) {
    return (
      <StateBand>
        No completed check has recorded a position yet, so there is no history
        to compare.
      </StateBand>
    );
  }

  return (
    <div style={TABLE_SCROLLER}>
      <table style={TABLE}>
        <thead>
          <tr style={HEAD_ROW}>
            <th style={TH_GUTTER}>Keyword</th>
            {runs.map((run) => (
              <th key={run.runId} style={TH_VALUE}>
                {formatDay(run.checkedAt)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keywords.map((keyword) => {
            const positions = byKeyword.get(keyword.trackingKeywordId);
            return (
              <HoverRow key={keyword.trackingKeywordId}>
                <td style={TD_GUTTER}>{keyword.keyword}</td>
                {runs.map((run) => {
                  const position = positions?.get(run.runId) ?? null;
                  return (
                    <td
                      key={run.runId}
                      style={{
                        ...TD_VALUE,
                        fontVariantNumeric: "tabular-nums",
                        color:
                          position === null ? "var(--text-3)" : "var(--text-2)",
                      }}
                    >
                      {position ?? "—"}
                    </td>
                  );
                })}
              </HoverRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface MatrixRun {
  runId: string;
  checkedAt: string;
}

function buildMatrix(cells: RankPositionMatrixCell[]): {
  runs: MatrixRun[];
  byKeyword: Map<string, Map<string, number | null>>;
} {
  const runMap = new Map<string, string>();
  const byKeyword = new Map<string, Map<string, number | null>>();
  for (const cell of cells) {
    runMap.set(cell.runId, cell.checkedAt);
    let positions = byKeyword.get(cell.trackingKeywordId);
    if (!positions) {
      positions = new Map();
      byKeyword.set(cell.trackingKeywordId, positions);
    }
    positions.set(cell.runId, cell.position);
  }
  // Newest first: the design reads left to right from the most recent check.
  const runs = [...runMap.entries()]
    .map(([runId, checkedAt]) => ({ runId, checkedAt }))
    .toSorted((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  return { runs, byKeyword };
}
