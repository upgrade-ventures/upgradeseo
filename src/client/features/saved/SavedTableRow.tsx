import { NoValue } from "@/client/components/prominence/Primitives";
import { DifficultyBadge } from "@/client/features/domain/components/DifficultyBadge";
import { IntentBadge } from "@/client/features/keywords/components";
import {
  Checkbox,
  ROW_LINE,
  TD,
  TD_NUM,
} from "@/client/features/saved/savedParts";
import { formatSavedKeywordDate } from "@/client/features/saved-keywords/savedKeywordsUtils";
import { resolveTagColor, tagDotClass } from "@/shared/tag-colors";
import type { KeywordIntent, SavedKeywordRow } from "@/types/keywords";

/** One saved keyword. Every cell renders its measurement or the design's
 * unavailable marker, never a stand-in value. */
export function SavedTableRow({
  row,
  isLast,
  selected,
  hovered,
  onHover,
  onToggle,
}: {
  row: SavedKeywordRow;
  isLast: boolean;
  selected: boolean;
  hovered: boolean;
  onHover: (hovered: boolean) => void;
  onToggle: (shiftKey: boolean) => void;
}) {
  return (
    <tr
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        borderBottom: isLast ? undefined : ROW_LINE,
        // Selection outranks hover: a selected row keeps its accent fill while
        // the pointer is over it.
        background: selected
          ? "var(--accent-soft)"
          : hovered
            ? "var(--subtle)"
            : undefined,
        // The design marks a selected row with a 2px accent bar on its leading
        // edge. `box-shadow: inset` draws it without a border-collapse fight
        // and without shifting the row by a pixel.
        boxShadow: selected ? "inset 2px 0 0 var(--accent)" : undefined,
      }}
    >
      <td style={TD}>
        <Checkbox
          label={`Select ${row.keyword}`}
          checked={selected}
          // Preventing the click's default cancels the toggle, so `onChange`
          // never runs for a shift-click and the range applies once.
          onClick={(event) => {
            if (!event.shiftKey) return;
            event.preventDefault();
            onToggle(true);
          }}
          onChange={() => onToggle(false)}
        />
      </td>
      <td style={{ ...TD, fontWeight: 600 }}>{row.keyword}</td>
      <td style={TD_NUM}>
        {row.searchVolume == null ? (
          <NoValue />
        ) : (
          row.searchVolume.toLocaleString()
        )}
      </td>
      <td style={TD_NUM}>
        {row.cpc == null ? <NoValue /> : `$${row.cpc.toFixed(2)}`}
      </td>
      <td style={TD_NUM}>
        {row.competition == null ? <NoValue /> : row.competition.toFixed(2)}
      </td>
      <td style={{ ...TD, textAlign: "right" }}>
        <DifficultyBadge value={row.keywordDifficulty} />
      </td>
      <td style={TD}>
        <IntentCell intent={row.intent} />
      </td>
      <td style={{ ...TD, minWidth: 150 }}>
        <ListsCell tags={row.tags} />
      </td>
      <td style={{ ...TD_NUM, color: "var(--text-2)" }}>
        {row.fetchedAt == null ? (
          <NoValue />
        ) : (
          formatSavedKeywordDate(row.fetchedAt)
        )}
      </td>
    </tr>
  );
}

const KNOWN_INTENTS: KeywordIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
];

/** No provider intent means no intent, not "unknown" as a finding. */
function IntentCell({ intent }: { intent: string | null }) {
  const known = KNOWN_INTENTS.find((candidate) => candidate === intent);
  return known ? <IntentBadge intent={known} /> : <NoValue />;
}

function ListsCell({ tags }: { tags: SavedKeywordRow["tags"] }) {
  if (tags.length === 0) return <NoValue />;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 18,
            padding: "0 7px",
            borderRadius: 999,
            fontSize: 11.5,
            color: "var(--text-2)",
            background: "var(--inset)",
            border: "1px solid var(--line)",
          }}
        >
          <span
            aria-hidden="true"
            className={tagDotClass(resolveTagColor(tag))}
            style={{ width: 6, height: 6, borderRadius: 999 }}
          />
          {tag.name}
        </span>
      ))}
    </span>
  );
}
