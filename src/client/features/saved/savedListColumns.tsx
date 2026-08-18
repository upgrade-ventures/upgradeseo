import { Icon } from "@/client/components/icons/IconSprite";
import {
  GROUP_LABEL,
  OptionRow,
} from "@/client/features/saved/savedListOption";
import { resolveTagColor, tagDotClass } from "@/shared/tag-colors";
import type { SavedKeywordTag, SavedKeywordTagSummary } from "@/types/keywords";

/** Lists the selection can be added to, plus the option to name a new one. */
export function AddColumn({
  tags,
  totalTagCount,
  selected,
  showCreate,
  createLabel,
  onCreate,
  onToggle,
}: {
  tags: SavedKeywordTagSummary[];
  /** Before filtering, so an empty result can say which emptiness it is. */
  totalTagCount: number;
  selected: Set<string>;
  showCreate: boolean;
  createLabel: string;
  onCreate: () => void;
  onToggle: (tag: SavedKeywordTagSummary) => void;
}) {
  return (
    <div>
      <span style={GROUP_LABEL}>Add to</span>
      <div
        style={{
          maxHeight: 200,
          overflowY: "auto",
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "var(--surface)",
        }}
      >
        {showCreate ? (
          <OptionRow
            onClick={onCreate}
            leading={
              <Icon
                name="i-plus"
                size={13}
                style={{ color: "var(--accent)" }}
              />
            }
          >
            <span style={{ color: "var(--text-2)" }}>Create list </span>
            <span style={{ fontWeight: 600 }}>{createLabel}</span>
          </OptionRow>
        ) : null}

        {tags.length === 0 && !showCreate ? (
          <p
            style={{
              margin: 0,
              padding: "16px 12px",
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-3)",
            }}
          >
            {totalTagCount === 0
              ? "No lists yet. Type a name above to start one."
              : "No list matches that name."}
          </p>
        ) : null}

        {tags.map((tag) => {
          const checked = selected.has(tag.normalizedName);
          return (
            <OptionRow
              key={tag.id}
              pressed={checked}
              onClick={() => onToggle(tag)}
              leading={
                <Icon
                  name={checked ? "i-check" : "i-plus"}
                  size={13}
                  style={{
                    color: checked ? "var(--accent)" : "var(--text-3)",
                  }}
                />
              }
              trailing={
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {tag.keywordCount.toLocaleString()}
                </span>
              }
            >
              <span
                aria-hidden="true"
                className={tagDotClass(resolveTagColor(tag))}
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  marginRight: 7,
                }}
              />
              {tag.name}
            </OptionRow>
          );
        })}
      </div>
    </div>
  );
}

/** Lists already on the selection, which is all that can be taken off. */
export function RemoveColumn({
  tags,
  selectedIds,
  emptyNote,
  onToggle,
}: {
  tags: SavedKeywordTag[];
  selectedIds: string[];
  emptyNote: string;
  onToggle: (tag: SavedKeywordTag) => void;
}) {
  return (
    <div>
      <span style={GROUP_LABEL}>Take off</span>
      {tags.length === 0 ? (
        <p
          style={{
            margin: 0,
            padding: "16px 12px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "var(--surface)",
            fontSize: 12,
            color: "var(--text-3)",
            textAlign: "center",
          }}
        >
          {emptyNote}
        </p>
      ) : (
        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "var(--surface)",
          }}
        >
          {tags.map((tag) => {
            const checked = selectedIds.includes(tag.id);
            return (
              <OptionRow
                key={tag.id}
                pressed={checked}
                onClick={() => onToggle(tag)}
                leading={
                  <Icon
                    name={checked ? "i-check" : "i-x"}
                    size={13}
                    style={{
                      color: checked ? "var(--danger)" : "var(--text-3)",
                    }}
                  />
                }
              >
                <span
                  aria-hidden="true"
                  className={tagDotClass(resolveTagColor(tag))}
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    marginRight: 7,
                  }}
                />
                {tag.name}
              </OptionRow>
            );
          })}
        </div>
      )}
    </div>
  );
}
