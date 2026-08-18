import type { ReactNode } from "react";

/**
 * Chart chrome shared by the rank trend and distribution plots.
 */

/**
 * Axis tick styling for every recharts axis on this screen.
 *
 * `var(--text-3)` rather than a grey literal: recharts writes the value into an
 * SVG `fill`, which resolves custom properties, so the ticks follow the theme
 * swap like the rest of the screen.
 */
export const CHART_TICK = { fontSize: 10, fill: "var(--text-3)" } as const;

/** Elevated box a recharts `<Tooltip content>` renders into. */
export function ChartTooltipBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--overlay)",
        boxShadow: "var(--shadow)",
        padding: "7px 11px",
        fontSize: 12,
        color: "var(--text)",
      }}
    >
      {children}
    </div>
  );
}
