import { useState, type CSSProperties } from "react";

import { Icon } from "@/client/components/icons/IconSprite";

import type { getCompetitors } from "@/serverFunctions/competitors";

/**
 * Table furniture shared by the competitor list and the per-competitor phrase
 * table.
 *
 * The Prominence design carries every declaration inline against the tokens
 * rather than in classes, so the two tables on this screen would drift apart
 * immediately if each wrote its own cells.
 */

export type Competitor = Awaited<ReturnType<typeof getCompetitors>>[number];

export const SCROLLER: CSSProperties = { overflowX: "auto", maxWidth: "100%" };

/** The min-width is what makes the scroller engage instead of squashing cells. */
export function tableStyle(minWidth: number): CSSProperties {
  return {
    width: "100%",
    minWidth,
    borderCollapse: "collapse",
    fontSize: 12.5,
  };
}

export const HEAD_ROW: CSSProperties = {
  background: "var(--subtle)",
  borderBottom: "1px solid var(--line)",
};

const TH: CSSProperties = {
  padding: "6px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-3)",
};

export const TH_LEFT = TH;
export const TH_RIGHT: CSSProperties = { ...TH, textAlign: "right" };
/** First and last columns sit in the screen gutter, so they track --pad. */
export const TH_FIRST: CSSProperties = {
  ...TH,
  padding: "6px var(--pad, 24px)",
};
export const TH_LAST: CSSProperties = {
  ...TH,
  textAlign: "right",
  padding: "6px var(--pad, 24px) 6px 12px",
};

export const TD: CSSProperties = { padding: "8px 12px" };
export const TD_NUM: CSSProperties = {
  ...TD,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.01em",
};
export const TD_FIRST: CSSProperties = {
  padding: "8px var(--pad, 24px)",
  fontWeight: 600,
};
export const TD_LAST: CSSProperties = {
  ...TD,
  padding: "8px var(--pad, 24px) 8px 12px",
  textAlign: "right",
};

export const ROW_LINE = "1px solid var(--border-muted)";

/**
 * Visually hidden, but kept in flow. Tailwind's `sr-only` is absolutely
 * positioned, which escapes the table's overflow-x scroller and widened the
 * whole page by the label's offset.
 */
const SR_ONLY: CSSProperties = {
  display: "inline-block",
  width: 1,
  height: 1,
  overflow: "hidden",
  whiteSpace: "nowrap",
};

/**
 * The design's proportion bar: a 140px pill track with an accent fill.
 *
 * The design gives the bar no text alternative, which leaves a screen reader an
 * empty cell. The label is a deliberate deviation; the number it states is the
 * same measured pair the bar draws, never a rounded-up story.
 */
export function ProportionBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        width: 140,
        height: 5,
        borderRadius: 999,
        background: "var(--inset)",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          background: "var(--accent)",
        }}
      />
    </div>
  );
}

/**
 * Row expander. The design's rows are inert; this screen has a detail panel to
 * open, so the affordance is a real button with the row's own type styling.
 */
export function DisclosureButton({
  expanded,
  controls,
  label,
  onClick,
}: {
  expanded: boolean;
  controls: string | undefined;
  label: string;
  onClick: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      onFocus={(event) =>
        setFocused(event.currentTarget.matches(":focus-visible"))
      }
      onBlur={() => setFocused(false)}
      // The row expander is the only way into the detail panel, so it has to
      // clear the 44px touch floor. A media query cannot be written inline.
      className="max-sm:min-h-11"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 4px",
        margin: "-2px -4px",
        border: "none",
        borderRadius: 5,
        background: "none",
        color: "inherit",
        font: "inherit",
        fontWeight: 600,
        cursor: "pointer",
        outline: "none",
        boxShadow: focused ? "var(--focus)" : undefined,
      }}
    >
      <Icon
        name={expanded ? "i-chev-down" : "i-chev-right"}
        size={13}
        style={{ color: "var(--text-3)" }}
      />
      {label}
    </button>
  );
}

export function HeadRow() {
  return (
    <thead>
      <tr style={HEAD_ROW}>
        <th scope="col" style={TH_FIRST}>
          Domain
        </th>
        <th scope="col" style={TH_RIGHT}>
          Pages seen
        </th>
        <th scope="col" style={TH_LEFT}>
          Publishes for
        </th>
        <th scope="col" style={TH_RIGHT}>
          Top phrases
        </th>
        <th scope="col" style={TH_RIGHT}>
          Last harvest
        </th>
        <th scope="col" style={TH_LAST}>
          <span style={SR_ONLY}>Actions</span>
        </th>
      </tr>
    </thead>
  );
}

/** Head row plus shimmering placeholders, the design's skeleton treatment. */
export function LoadingTable() {
  const cells: Array<{ style: CSSProperties; width: number; right?: true }> = [
    { style: TD_FIRST, width: 140 },
    { style: TD_NUM, width: 34, right: true },
    { style: TD, width: 90 },
    { style: TD_NUM, width: 34, right: true },
    { style: TD_NUM, width: 48, right: true },
    { style: TD_LAST, width: 96, right: true },
  ];

  return (
    <div style={SCROLLER} aria-busy="true">
      <table style={tableStyle(760)}>
        <HeadRow />
        <tbody>
          {[0, 1, 2].map((row) => (
            <tr
              key={row}
              style={{ borderBottom: row === 2 ? undefined : ROW_LINE }}
            >
              {cells.map((cell, index) => (
                <td key={index} style={cell.style}>
                  <div
                    style={{
                      height: 10,
                      width: cell.width,
                      maxWidth: "100%",
                      marginLeft: cell.right ? "auto" : undefined,
                      borderRadius: 999,
                      background: "var(--inset)",
                      animation: "shimmer 1.4s ease-in-out infinite",
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
