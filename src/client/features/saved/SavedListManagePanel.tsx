import { useState } from "react";

import {
  PrimaryButton,
  SecondaryButton,
} from "@/client/components/prominence/Primitives";
import {
  FIELD,
  FIELD_LABEL,
  ROW_LINE,
  useFocusRing,
} from "@/client/features/saved/savedParts";
import {
  resolveTagColor,
  TAG_COLOR_KEYS,
  tagSwatchClass,
  type TagColorKey,
} from "@/shared/tag-colors";
import type { SavedKeywordTagSummary } from "@/types/keywords";

/**
 * Rename, recolour or delete one list.
 *
 * The design has no list controls at all, so this is the existing tag
 * management re-expressed inline under the row it belongs to.
 */
export function ManageListPanel({
  id,
  tag,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  id: string;
  tag: SavedKeywordTagSummary;
  busy: boolean;
  onSave: (input: { name?: string; color?: TagColorKey | null }) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const currentColor = resolveTagColor(tag);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState<TagColorKey>(currentColor);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { focusRing, focusProps } = useFocusRing();

  const nameChanged = name.trim() !== tag.name && name.trim().length > 0;
  const colorChanged = color !== currentColor;

  return (
    <div
      id={id}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 14,
        padding: "10px 12px",
        background: "var(--subtle)",
        borderTop: ROW_LINE,
      }}
    >
      <div style={{ minWidth: 180, flex: 1 }}>
        <label style={FIELD_LABEL} htmlFor={`${id}-name`}>
          List name
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          {...focusProps}
          style={{ ...FIELD, width: "100%", boxShadow: focusRing }}
        />
      </div>

      <div>
        <span style={FIELD_LABEL}>Colour</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {TAG_COLOR_KEYS.map((key) => (
            <ColorSwatch
              key={key}
              colorKey={key}
              selected={color === key}
              onSelect={() => setColor(key)}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginLeft: "auto",
        }}
      >
        {/* Two taps rather than a confirm dialog: deleting a list is reversible
            only by re-tagging every keyword. */}
        <DangerButton
          busy={busy}
          confirming={confirmingDelete}
          onClick={() => {
            if (!confirmingDelete) {
              setConfirmingDelete(true);
              return;
            }
            setConfirmingDelete(false);
            onDelete();
          }}
        />
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        <PrimaryButton
          disabled={busy || (!nameChanged && !colorChanged)}
          onClick={() =>
            onSave({
              name: nameChanged ? name.trim() : undefined,
              color: colorChanged ? color : undefined,
            })
          }
        >
          Save
        </PrimaryButton>
      </div>
    </div>
  );
}

function ColorSwatch({
  colorKey,
  selected,
  onSelect,
}: {
  colorKey: TagColorKey;
  selected: boolean;
  onSelect: () => void;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={colorKey}
      className={tagSwatchClass(colorKey)}
      {...focusProps}
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        border: selected
          ? "2px solid var(--text)"
          : "1px solid var(--border-strong)",
        cursor: "pointer",
        outline: "none",
        boxShadow: focusRing,
      }}
    />
  );
}

function DangerButton({
  busy,
  confirming,
  onClick,
}: {
  busy: boolean;
  confirming: boolean;
  onClick: () => void;
}) {
  const { focusRing, focusProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      {...focusProps}
      style={{
        minHeight: 28,
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${confirming ? "var(--danger)" : "var(--danger-border)"}`,
        background: confirming ? "var(--danger-soft)" : "var(--surface)",
        color: "var(--danger)",
        fontFamily: "inherit",
        fontSize: 12.5,
        fontWeight: confirming ? 600 : 400,
        cursor: busy ? "progress" : "pointer",
        whiteSpace: "nowrap",
        outline: "none",
        boxShadow: focusRing,
      }}
    >
      {confirming ? "Confirm delete" : "Delete list"}
    </button>
  );
}
