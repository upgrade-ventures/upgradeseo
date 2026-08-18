import { NoValue } from "@/client/components/prominence/Primitives";
import { MentionPill } from "@/client/features/ai-search/components/aiControls";
import {
  FIRST_CELL,
  HEAD_CELL_STYLE,
  HEAD_ROW_STYLE,
  MID_CELL,
  LAST_CELL,
  MessageRow,
  PromptLink,
  SortHeader,
  TABLE_STYLE,
  TableScroller,
  useHoveredRow,
  type SortState,
} from "@/client/features/ai-search/components/aiTableParts";
import {
  formatCount,
  formatPlatformLabel,
} from "@/client/features/ai-search/platformLabels";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

type TopQueryRow = BrandLookupResult["topQueries"][number];

/**
 * The design's sampled-prompt table: prompt, model, whether you were named, and
 * who else was.
 *
 * The design's "You" cell carries a rank ("Mentioned · 2nd") and its last column
 * is "Named ahead of you". Neither survives contact with the data: the source
 * reports which brands an answer named, not the order it named them in. The
 * column says what it can defend instead of asserting an order nobody measured.
 */
export function BrandLookupQueriesTable({
  rows,
  resolvedTarget,
  projectId,
  showPlatform,
  sort,
  onSortChange,
  emptyMessage,
}: {
  rows: TopQueryRow[];
  resolvedTarget: string;
  projectId: string;
  showPlatform: boolean;
  sort: SortState;
  onSortChange: (next: SortState) => void;
  emptyMessage: string;
}) {
  const { rowProps } = useHoveredRow();
  const columnCount = showPlatform ? 5 : 4;

  return (
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
              Prompt
            </th>
            {showPlatform ? (
              <th
                scope="col"
                style={{
                  ...HEAD_CELL_STYLE,
                  textAlign: "left",
                  padding: "6px 12px",
                }}
              >
                Model
              </th>
            ) : null}
            <th
              scope="col"
              style={{
                ...HEAD_CELL_STYLE,
                textAlign: "left",
                padding: "6px 12px",
              }}
            >
              You
            </th>
            <th
              scope="col"
              style={{
                ...HEAD_CELL_STYLE,
                textAlign: "left",
                padding: "6px 12px",
              }}
            >
              Other brands named
            </th>
            <th
              scope="col"
              aria-sort={sort.desc ? "descending" : "ascending"}
              style={{
                ...HEAD_CELL_STYLE,
                textAlign: "right",
                padding: "6px var(--pad, 24px) 6px 12px",
              }}
            >
              <SortHeader
                label="AI search vol."
                desc={sort.desc}
                onToggle={() => onSortChange({ desc: !sort.desc })}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <MessageRow colSpan={columnCount}>{emptyMessage}</MessageRow>
          ) : (
            rows.map((row) => {
              const key = `${row.platform}:${row.question}`;
              const others = row.brandsMentioned.filter(
                (brand) => brand.toLowerCase() !== resolvedTarget.toLowerCase(),
              );
              return (
                <tr key={key} {...rowProps(key)}>
                  <td style={FIRST_CELL}>
                    <PromptLink
                      projectId={projectId}
                      question={row.question}
                      brand={resolvedTarget}
                    />
                  </td>
                  {showPlatform ? (
                    <td style={MID_CELL}>
                      {formatPlatformLabel(row.platform)}
                    </td>
                  ) : null}
                  <td style={{ padding: "var(--rp, 5px) 12px" }}>
                    {/* The source only returns prompts whose answer named the
                        target, so every row here is a mention. */}
                    <MentionPill tone="mentioned">Mentioned</MentionPill>
                  </td>
                  <td
                    style={{
                      ...MID_CELL,
                      color:
                        others.length > 0 ? "var(--text-2)" : "var(--text-3)",
                    }}
                  >
                    {others.length > 0 ? others.join(", ") : "—"}
                  </td>
                  <td style={LAST_CELL}>
                    {row.aiSearchVolume == null ? (
                      <NoValue />
                    ) : (
                      formatCount(row.aiSearchVolume)
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </TableScroller>
  );
}
