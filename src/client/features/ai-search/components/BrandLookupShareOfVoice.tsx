import { useState } from "react";
import { NoValue } from "@/client/components/prominence/Primitives";
import { InfoCallout } from "@/client/features/ai-search/components/aiControls";
import {
  HEAD_CELL_STYLE,
  HEAD_ROW_STYLE,
  MessageRow,
  TABLE_STYLE,
  TableScroller,
} from "@/client/features/ai-search/components/aiTableParts";
import {
  formatCount,
  formatPlatformLabel,
} from "@/client/features/ai-search/platformLabels";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

type ShareOfVoice = NonNullable<BrandLookupResult["shareOfVoice"]>;

/**
 * The design's competitor share table: domain, mention rate, average rank in
 * the answer, and whether the domain was cited as a source.
 *
 * Two of those four have no source here. Rank inside an answer is not extracted
 * by anything we run, and our model answers without a web-search tool so it
 * cites no sources at all; both columns stay explicitly empty. What is real is
 * each domain's share of the mentions we counted, so that replaces the design's
 * "mention rate", which would need a per-domain denominator we never measured.
 */
export function BrandLookupShareOfVoice({
  shareOfVoice,
  resolvedTarget,
  hasCompetitors,
}: {
  shareOfVoice: ShareOfVoice | null;
  resolvedTarget: string;
  /** Whether the user actually named competitors to compare against. */
  hasCompetitors: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const entries = shareOfVoice?.entries ?? [];

  return (
    <>
      <TableScroller>
        <table style={TABLE_STYLE}>
          <thead>
            <tr style={HEAD_ROW_STYLE}>
              <th
                scope="col"
                style={{
                  ...HEAD_CELL_STYLE,
                  textAlign: "left",
                  padding: "6px var(--pad, 24px)",
                }}
              >
                Domain
              </th>
              <th
                scope="col"
                style={{
                  ...HEAD_CELL_STYLE,
                  textAlign: "right",
                  padding: "6px 12px",
                }}
              >
                Mentions
              </th>
              <th
                scope="col"
                style={{
                  ...HEAD_CELL_STYLE,
                  textAlign: "right",
                  padding: "6px 12px",
                }}
              >
                Share of mentions
              </th>
              <th
                scope="col"
                style={{
                  ...HEAD_CELL_STYLE,
                  textAlign: "right",
                  padding: "6px 12px",
                }}
              >
                Avg rank in answer
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <MessageRow colSpan={4}>
                {hasCompetitors
                  ? `Competitor share needs the same measurement for every domain in the comparison, and this run produced none for ${resolvedTarget} or its competitors.`
                  : "Add competitors to the lookup above to compare them against this brand."}
              </MessageRow>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.label}
                  onMouseEnter={() => setHovered(entry.label)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    borderBottom: "1px solid var(--border-muted)",
                    background:
                      hovered === entry.label ? "var(--subtle)" : "transparent",
                  }}
                >
                  <td
                    style={{
                      padding: "var(--rp, 5px) var(--pad, 24px)",
                      textAlign: "left",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {entry.label}
                      {/* The design gives the tracked domain no marker. With an
                          arbitrary lookup target the row is otherwise
                          indistinguishable from its competitors. */}
                      {entry.isTarget ? <YouBadge /> : null}
                    </span>
                  </td>
                  <NumberCell>
                    {entry.mentions == null ? (
                      <NoValue />
                    ) : (
                      formatCount(entry.mentions)
                    )}
                  </NumberCell>
                  <NumberCell>
                    {entry.sharePct == null ? (
                      <NoValue />
                    ) : (
                      `${Math.round(entry.sharePct)}%`
                    )}
                  </NumberCell>
                  <NumberCell>
                    <NoValue />
                  </NumberCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScroller>

      <InfoCallout>
        {shareOfVoice
          ? `Share is each domain's portion of the mentions counted across ${shareOfVoice.platforms.map(formatPlatformLabel).join(" and ")}. `
          : ""}
        Where a brand sits inside an answer is not extracted by anything we run,
        and our model answers without a web-search tool, so it cites no sources:
        those columns are left empty rather than filled with a guess.
      </InfoCallout>
    </>
  );
}

function NumberCell({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "var(--rp, 5px) 12px",
        textAlign: "right",
        color: "var(--text-2)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </td>
  );
}

function YouBadge() {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--accent)",
        border: "1px solid var(--accent-border)",
        background: "var(--accent-soft)",
        borderRadius: 999,
        padding: "0 6px",
      }}
    >
      You
    </span>
  );
}
