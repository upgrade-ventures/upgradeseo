import { type CSSProperties } from "react";
import { INTENT_LABELS } from "@/client/features/keywords/components/IntentBadge";
import type { KeywordIntent } from "@/types/keywords";
import { useFocusRing } from "./prominenceControls";

/**
 * Cell-level presentation for the keyword research table: the tones the design
 * assigns to a difficulty score and an intent, the checkbox, and the marker for
 * a value no connected source reported.
 */

export const NUMERIC_CELL: CSSProperties = {
  padding: "var(--rp, 5px) 8px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: ".01em",
  color: "var(--text-2)",
};

const BADGE: CSSProperties = {
  display: "inline-block",
  minWidth: 26,
  padding: "1px 6px",
  borderRadius: 5,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: ".01em",
  fontSize: 11.5,
  fontWeight: 600,
};

/**
 * The design shows three difficulty colours and names no thresholds. These
 * match the tiers the rest of the app already scores difficulty with, and they
 * bucket every value the design shows the way it shows them.
 */
function difficultyTone(value: number): CSSProperties {
  if (value <= 35) {
    return {
      color: "var(--success)",
      background: "var(--success-soft)",
      border: "1px solid var(--success-border)",
    };
  }
  if (value <= 65) {
    return {
      color: "var(--warning)",
      background: "var(--warning-soft)",
      border: "1px solid var(--warning-border)",
    };
  }
  return {
    color: "var(--danger)",
    background: "var(--danger-soft)",
    border: "1px solid var(--danger-border)",
  };
}

/**
 * The design assigns a colour to Commercial and Informational only. The other
 * two intents reuse the tokens the rest of the app already reads them with.
 */
const INTENT_TONE: Record<
  Exclude<KeywordIntent, "unknown">,
  { fg: string; bg: string }
> = {
  commercial: { fg: "var(--purple)", bg: "var(--purple-soft)" },
  informational: { fg: "var(--info)", bg: "var(--info-soft)" },
  transactional: { fg: "var(--success)", bg: "var(--success-soft)" },
  navigational: { fg: "var(--accent)", bg: "var(--accent-soft)" },
};

/**
 * A row or select-all checkbox.
 *
 * The label wrapper exists for the hit target: on mobile it grows to `--tap`
 * without inflating the box itself, which the design draws at its native size.
 * The focus ring is the token one, applied from state because a screen may not
 * add a `:focus-visible` rule to shared CSS.
 */
export function TableCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  const { ring, ringProps } = useFocusRing();

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "max(20px, var(--tap, 0px))",
        paddingRight: 8,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        ref={(node) => {
          if (node) node.indeterminate = indeterminate;
        }}
        onChange={onChange}
        aria-label={label}
        {...ringProps}
        style={{ accentColor: "var(--accent)", borderRadius: 3, ...ring }}
      />
    </label>
  );
}

/** The design's own marker for a value no connected source can supply. */
export function NoCellValue({ reason }: { reason: string }) {
  return (
    <span style={{ color: "var(--text-3)" }} title={reason}>
      <span aria-hidden>—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

/** Difficulty score, coloured by the tier it falls in. */
export function DifficultyBadge({ value }: { value: number }) {
  return <span style={{ ...BADGE, ...difficultyTone(value) }}>{value}</span>;
}

/** Search intent, in the tone the design gives that intent. */
export function IntentTag({
  intent,
}: {
  intent: Exclude<KeywordIntent, "unknown">;
}) {
  return (
    <span
      style={{
        fontSize: 11.5,
        color: INTENT_TONE[intent].fg,
        background: INTENT_TONE[intent].bg,
        borderRadius: 5,
        padding: "1px 6px",
      }}
    >
      {INTENT_LABELS[intent]}
    </span>
  );
}
