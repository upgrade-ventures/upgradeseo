import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@/client/components/icons/IconSprite";
import { useFocusRing } from "@/client/features/ai-search/components/aiControls";

/**
 * The shape both AI Visibility tables share: the design's full-bleed table with
 * a subtle head strip, `--pad` gutters on the outer columns and 12px between,
 * plus the sorting and hover behaviour the design carries as a `style-hover`
 * attribute its own renderer understands and CSS does not.
 */

export const TABLE_STYLE = {
  width: "100%",
  minWidth: 560,
  borderCollapse: "collapse",
  fontSize: 12.5,
} satisfies CSSProperties;

export const HEAD_ROW_STYLE = {
  background: "var(--subtle)",
  borderBottom: "1px solid var(--line)",
} satisfies CSSProperties;

export const HEAD_CELL_STYLE = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-3)",
} satisfies CSSProperties;

export const FIRST_CELL = {
  padding: "var(--rp, 5px) var(--pad, 24px)",
  fontWeight: 600,
} satisfies CSSProperties;

export const MID_CELL = {
  padding: "var(--rp, 5px) 12px",
  color: "var(--text-2)",
} satisfies CSSProperties;

export const LAST_CELL = {
  padding: "var(--rp, 5px) var(--pad, 24px) var(--rp, 5px) 12px",
  textAlign: "right",
  color: "var(--text-2)",
  fontVariantNumeric: "tabular-nums",
} satisfies CSSProperties;

/** Both tables scroll sideways rather than reflowing below 560px. */
export function TableScroller({ children }: { children: ReactNode }) {
  return <div style={{ overflowX: "auto", maxWidth: "100%" }}>{children}</div>;
}

/** Full-width row used for the empty and error states of a table. */
export function MessageRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          padding: "20px var(--pad, 24px)",
          fontSize: 12.5,
          color: "var(--text-2)",
        }}
      >
        {children}
      </td>
    </tr>
  );
}

export type SortState = { desc: boolean };

/** Nulls sort last in both directions: "not reported" is not a small number. */
export function sortByNumber<T>(
  rows: T[],
  value: (row: T) => number | null,
  desc: boolean,
): T[] {
  return rows.toSorted((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    return desc ? right - left : left - right;
  });
}

export function SortHeader({
  label,
  desc,
  onToggle,
}: {
  label: string;
  desc: boolean;
  onToggle: () => void;
}) {
  const { ring, ringProps } = useFocusRing();
  return (
    <button
      type="button"
      onClick={onToggle}
      {...ringProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: 0,
        border: "none",
        background: "none",
        font: "inherit",
        letterSpacing: "inherit",
        textTransform: "inherit",
        color: "var(--text-2)",
        cursor: "pointer",
        borderRadius: 4,
        ...ring,
      }}
    >
      {label}
      <Icon name={desc ? "i-arrow-down" : "i-arrow-up"} size={11} />
    </button>
  );
}

/** One row at a time carries the design's `background: var(--subtle)` hover. */
export function useHoveredRow() {
  const [hovered, setHovered] = useState<string | null>(null);
  return {
    rowProps: (key: string) => ({
      onMouseEnter: () => setHovered(key),
      onMouseLeave: () => setHovered(null),
      style: {
        background: hovered === key ? "var(--subtle)" : "transparent",
        borderBottom: "1px solid var(--border-muted)",
      } satisfies CSSProperties,
    }),
  };
}

/** Every sampled prompt can be re-asked on the Prompt explorer tab. */
export function PromptLink({
  projectId,
  question,
  brand,
}: {
  projectId: string;
  question: string;
  brand: string;
}) {
  const { ring, ringProps } = useFocusRing();
  return (
    <Link
      to="/p/$projectId/prompt-explorer"
      params={{ projectId }}
      search={{ q: question, hb: brand || undefined }}
      title="Ask this prompt on the Prompt explorer tab"
      {...ringProps}
      style={{ color: "inherit", borderRadius: 4, ...ring }}
    >
      {question}
    </Link>
  );
}
