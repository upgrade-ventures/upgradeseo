import { useEffect, useMemo, useRef, useState } from "react";

import {
  FIELD,
  ROW_LINE,
  useFocusRing,
} from "@/client/features/saved/savedParts";
import {
  AddColumn,
  RemoveColumn,
} from "@/client/features/saved/savedListColumns";
import type { SavedKeywordTag, SavedKeywordTagSummary } from "@/types/keywords";

/**
 * Add the selected keywords to a list, or take them off one.
 *
 * This was a modal. The design has no modal surface at all, so the panel is
 * drawn in place, directly under the selection band that opened it and above
 * the rows it acts on, in the same vocabulary as the filter panel next to it.
 * Escape closes it and focus returns to the search field it opened with.
 */
export function SavedListAssignPanel({
  id,
  availableTags,
  selectedCount,
  /** Lists already on the selected rows, deduped. These are what can come off. */
  selectedRowTags,
  isPending,
  onCancel,
  onApply,
}: {
  id: string;
  availableTags: SavedKeywordTagSummary[];
  selectedCount: number;
  selectedRowTags: SavedKeywordTag[];
  isPending: boolean;
  onCancel: () => void;
  onApply: (input: { addTags?: string[]; removeTagIds?: string[] }) => void;
}) {
  const [query, setQuery] = useState("");
  const [addNames, setAddNames] = useState<string[]>([]);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useFocusRing();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const normalizedAddSet = useMemo(
    () => new Set(addNames.map((name) => name.toLocaleLowerCase())),
    [addNames],
  );
  const existingNormalized = useMemo(
    () => new Set(availableTags.map((tag) => tag.normalizedName)),
    [availableTags],
  );

  const trimmedQuery = query.trim();
  const queryNormalized = trimmedQuery.toLocaleLowerCase();
  const filtered = useMemo(() => {
    if (!queryNormalized) return availableTags;
    return availableTags.filter((tag) =>
      tag.normalizedName.includes(queryNormalized),
    );
  }, [availableTags, queryNormalized]);

  const showCreate =
    trimmedQuery.length > 0 &&
    !existingNormalized.has(queryNormalized) &&
    !normalizedAddSet.has(queryNormalized);

  const canApply = !isPending && (addNames.length > 0 || removeIds.length > 0);
  const plural = selectedCount === 1 ? "" : "s";

  const toggleAdd = (tag: SavedKeywordTagSummary) => {
    setAddNames((current) =>
      normalizedAddSet.has(tag.normalizedName)
        ? current.filter(
            (name) => name.toLocaleLowerCase() !== tag.normalizedName,
          )
        : [...current, tag.name],
    );
    // A list cannot be added and removed in the same apply.
    setRemoveIds((current) => current.filter((tagId) => tagId !== tag.id));
  };

  const createFromQuery = () => {
    if (!trimmedQuery) return;
    setAddNames((current) =>
      normalizedAddSet.has(queryNormalized)
        ? current
        : [...current, trimmedQuery],
    );
    setQuery("");
    inputRef.current?.focus();
  };

  const toggleRemove = (tag: SavedKeywordTag) => {
    setRemoveIds((current) =>
      current.includes(tag.id)
        ? current.filter((tagId) => tagId !== tag.id)
        : [...current, tag.id],
    );
    setAddNames((current) =>
      current.filter((name) => name.toLocaleLowerCase() !== tag.normalizedName),
    );
  };

  return (
    <div
      id={id}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCancel();
      }}
      style={{
        padding: "12px var(--pad, 24px)",
        background: "var(--subtle)",
        borderBottom: ROW_LINE,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
        <strong style={{ color: "var(--text)", fontWeight: 600 }}>
          Lists for {selectedCount.toLocaleString()} keyword{plural}
        </strong>
        . Adding puts {selectedCount === 1 ? "it" : "them"} on a list; removing
        takes {selectedCount === 1 ? "it" : "them"} off. The keyword
        {plural} {selectedCount === 1 ? "stays" : "stay"} saved either way.
      </div>

      <div style={{ maxWidth: 420 }}>
        <label
          htmlFor={`${id}-search`}
          style={{
            display: "block",
            fontSize: 12.5,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Find or name a list
        </label>
        <input
          id={`${id}-search`}
          ref={inputRef}
          type="text"
          value={query}
          autoComplete="off"
          placeholder="Q3 content plan"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && showCreate) {
              event.preventDefault();
              createFromQuery();
            }
          }}
          onFocus={search.focusProps.onFocus}
          onBlur={search.focusProps.onBlur}
          style={{
            ...FIELD,
            width: "100%",
            minHeight: 30,
            boxShadow: search.focusRing,
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        <AddColumn
          tags={filtered}
          totalTagCount={availableTags.length}
          selected={normalizedAddSet}
          showCreate={showCreate}
          createLabel={trimmedQuery}
          onCreate={createFromQuery}
          onToggle={toggleAdd}
        />

        <RemoveColumn
          tags={selectedRowTags}
          selectedIds={removeIds}
          emptyNote={`The selected keyword${plural} ${selectedCount === 1 ? "is" : "are"} not on any list.`}
          onToggle={toggleRemove}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* The button says why it is off; it is never just greyed out. */}
        <span
          aria-live="polite"
          style={{ fontSize: 12, color: "var(--text-2)", flex: 1 }}
        >
          {canApply
            ? [
                addNames.length > 0
                  ? `Adding to ${addNames.length} list${addNames.length === 1 ? "" : "s"}`
                  : null,
                removeIds.length > 0 ? `taking off ${removeIds.length}` : null,
              ]
                .filter(Boolean)
                .join(", ")
            : "Pick at least one list to add to or take off."}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="prominence-button-secondary max-sm:min-h-11"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canApply}
          onClick={() =>
            onApply({
              addTags: addNames.length > 0 ? addNames : undefined,
              removeTagIds: removeIds.length > 0 ? removeIds : undefined,
            })
          }
          className="prominence-button-primary max-sm:min-h-11"
        >
          {isPending ? "Applying…" : "Apply"}
        </button>
      </div>
    </div>
  );
}
