import { useMemo, useState } from "react";

import { Icon } from "@/client/components/icons/IconSprite";
import {
  Card,
  SecondaryButton,
  StatusPill,
} from "@/client/components/prominence/Primitives";
import { ManageListPanel } from "@/client/features/saved/SavedListManagePanel";
import {
  FIELD,
  ROW_LINE,
  SkeletonBar,
  UnavailableNote,
  useFocusRing,
} from "@/client/features/saved/savedParts";
import {
  resolveTagColor,
  tagDotClass,
  type TagColorKey,
} from "@/shared/tag-colors";
import type { SavedKeywordTagSummary } from "@/types/keywords";

/**
 * The design's "Your lists" card.
 *
 * A list in this app is a tag on saved keywords, so the rows are the project's
 * tags and the row count is the tag's keyword count — both measured.
 *
 * The design's other two figures (combined volume, average difficulty) and its
 * Tracked / Not tracked pill have no source here: nothing aggregates metrics
 * per tag, and rank tracking is configured per domain with no link to a tag. A
 * pill reading "Not tracked" would be a claim we cannot make, so the row states
 * what it knows and the card says plainly what it does not.
 */

/** Above this many lists the card gets a filter box of its own. */
const SEARCH_THRESHOLD = 8;

export function SavedListsCard({
  tags,
  selectedTagIds,
  busyTagIds,
  isLoading,
  isError,
  canStartList,
  onToggleTag,
  onClearSelection,
  onStartList,
  onUpdateTag,
  onDeleteTag,
}: {
  tags: SavedKeywordTagSummary[];
  selectedTagIds: string[];
  busyTagIds: Set<string>;
  isLoading: boolean;
  isError: boolean;
  /** A list is created by tagging keywords, so it needs a selection to exist. */
  canStartList: boolean;
  onToggleTag: (tagId: string) => void;
  onClearSelection: () => void;
  onStartList: () => void;
  onUpdateTag: (input: {
    tagId: string;
    name?: string;
    color?: TagColorKey | null;
  }) => void;
  onDeleteTag: (tagId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [managingTagId, setManagingTagId] = useState<string | null>(null);
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);
  const { focusRing, focusProps } = useFocusRing();

  const visibleTags = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.normalizedName.includes(q));
  }, [query, tags]);

  const showSearch = tags.length > SEARCH_THRESHOLD;

  return (
    <Card
      title="Your lists"
      count={isLoading || isError ? undefined : tags.length}
      headerRight={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectedTagIds.length > 0 ? (
            <SecondaryButton onClick={onClearSelection}>
              Clear list filter
            </SecondaryButton>
          ) : null}
          <SecondaryButton
            onClick={onStartList}
            disabled={!canStartList}
            title={
              canStartList
                ? "Add the selected keywords to a new list"
                : "Select keywords in the table below to start a list"
            }
          >
            New list
          </SecondaryButton>
        </div>
      }
    >
      {showSearch ? (
        <div style={{ padding: "8px 12px", borderBottom: ROW_LINE }}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter lists"
            aria-label="Filter lists by name"
            {...focusProps}
            style={{ ...FIELD, width: "100%", boxShadow: focusRing }}
          />
        </div>
      ) : null}

      {isLoading ? <ListsSkeleton /> : null}

      {!isLoading && isError ? (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: "12px",
            fontSize: 12.5,
            color: "var(--danger)",
          }}
        >
          Your lists could not be loaded. Retry from the table below.
        </p>
      ) : null}

      {!isLoading && !isError && tags.length === 0 ? (
        <p
          style={{
            margin: 0,
            padding: "14px 12px",
            fontSize: 12.5,
            color: "var(--text-2)",
          }}
        >
          No lists yet. Select keywords in the table below and use Tag to start
          one.
        </p>
      ) : null}

      {!isLoading && !isError && tags.length > 0 && visibleTags.length === 0 ? (
        <p
          style={{
            margin: 0,
            padding: "14px 12px",
            fontSize: 12.5,
            color: "var(--text-2)",
          }}
        >
          No list matches that name.
        </p>
      ) : null}

      {visibleTags.map((tag, index) => (
        <ListRow
          key={tag.id}
          tag={tag}
          isLast={index === visibleTags.length - 1}
          selected={selectedTagIds.includes(tag.id)}
          hovered={hoveredTagId === tag.id}
          busy={busyTagIds.has(tag.id)}
          managing={managingTagId === tag.id}
          onHover={(hovered) => setHoveredTagId(hovered ? tag.id : null)}
          onToggle={() => onToggleTag(tag.id)}
          onToggleManage={() =>
            setManagingTagId(managingTagId === tag.id ? null : tag.id)
          }
          onUpdate={(input) => {
            onUpdateTag({ tagId: tag.id, ...input });
            setManagingTagId(null);
          }}
          onDelete={() => {
            onDeleteTag(tag.id);
            setManagingTagId(null);
          }}
        />
      ))}

      {!isLoading && !isError && tags.length > 0 ? (
        <UnavailableNote>
          Combined volume and average difficulty are not measured per list.
          Per-keyword volume, CPC and difficulty are in the table below. Rank
          tracking is set up per domain in Rank Tracking, so a list carries no
          tracking state of its own.
        </UnavailableNote>
      ) : null}
    </Card>
  );
}

function ListRow({
  tag,
  isLast,
  selected,
  hovered,
  busy,
  managing,
  onHover,
  onToggle,
  onToggleManage,
  onUpdate,
  onDelete,
}: {
  tag: SavedKeywordTagSummary;
  isLast: boolean;
  selected: boolean;
  hovered: boolean;
  busy: boolean;
  managing: boolean;
  onHover: (hovered: boolean) => void;
  onToggle: () => void;
  onToggleManage: () => void;
  onUpdate: (input: { name?: string; color?: TagColorKey | null }) => void;
  onDelete: () => void;
}) {
  const nameRing = useFocusRing();
  const manageRing = useFocusRing();
  const panelId = `saved-list-manage-${tag.id}`;

  return (
    <div style={{ borderBottom: isLast && !managing ? undefined : ROW_LINE }}>
      <div
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "9px 12px",
          background: selected
            ? "var(--accent-soft)"
            : hovered
              ? "var(--subtle)"
              : undefined,
          opacity: busy ? 0.6 : undefined,
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          disabled={busy}
          {...nameRing.focusProps}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flex: 1,
            minWidth: 0,
            padding: "2px 4px",
            margin: "-2px -4px",
            border: "none",
            borderRadius: 5,
            background: "none",
            color: "inherit",
            font: "inherit",
            textAlign: "left",
            cursor: busy ? "progress" : "pointer",
            outline: "none",
            boxShadow: nameRing.focusRing,
          }}
        >
          <span
            aria-hidden="true"
            className={tagDotClass(resolveTagColor(tag))}
            style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0 }}
          />
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tag.name}
            </span>
            <span
              style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}
            >
              {tag.keywordCount.toLocaleString()} keyword
              {tag.keywordCount === 1 ? "" : "s"}
            </span>
          </span>
        </button>

        {selected ? <StatusPill tone="info">Filtering</StatusPill> : null}

        <button
          type="button"
          onClick={onToggleManage}
          aria-expanded={managing}
          aria-controls={managing ? panelId : undefined}
          aria-label={`List options for ${tag.name}`}
          disabled={busy}
          {...manageRing.focusProps}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: 3,
            margin: -3,
            border: "none",
            borderRadius: 5,
            background: "none",
            color: "var(--text-3)",
            cursor: busy ? "progress" : "pointer",
            outline: "none",
            boxShadow: manageRing.focusRing,
          }}
        >
          <Icon name={managing ? "i-chev-down" : "i-chev-right"} size={14} />
        </button>
      </div>

      {managing ? (
        <ManageListPanel
          id={panelId}
          tag={tag}
          busy={busy}
          onSave={onUpdate}
          onDelete={onDelete}
          onCancel={onToggleManage}
        />
      ) : null}
    </div>
  );
}

function ListsSkeleton() {
  return (
    <div aria-busy="true">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 12px",
            borderBottom: row === 2 ? undefined : ROW_LINE,
          }}
        >
          <div style={{ flex: 1, display: "grid", gap: 6 }}>
            <SkeletonBar width={140} />
            <SkeletonBar width={90} height={8} />
          </div>
          <SkeletonBar width={54} />
        </div>
      ))}
    </div>
  );
}
