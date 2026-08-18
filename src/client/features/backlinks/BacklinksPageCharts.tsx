import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "@/client/components/icons/IconSprite";
import type { BacklinksOverviewData } from "./backlinksPageTypes";
import {
  formatCompactDate,
  formatMonthLabel,
  formatTooltipValue,
} from "./backlinksPageUtils";

/**
 * Series colours.
 *
 * The design draws no multi-series chart, so it names no palette for one. These
 * are the four semantic tokens that already carry the right meaning in both
 * themes: two neutral series (accent, info) and the gain/loss pair
 * (success, danger). Nothing here is a literal colour, so dark mode swaps with
 * the rest of the screen.
 */
const SERIES = {
  backlinks: "var(--accent)",
  referringDomains: "var(--info)",
  gained: "var(--success)",
  lost: "var(--danger)",
} as const;

/** Axis furniture. Recharts defaults to its own greys, which are unreadable on
 * the dark canvas, so ticks and lines are pinned to the text tokens. */
const AXIS_TICK = { fill: "var(--text-3)", fontSize: 11 } as const;
const AXIS_LINE = "var(--line)";
const TOOLTIP_STYLE = {
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--overlay)",
  color: "var(--text)",
  fontSize: 12.5,
  boxShadow: "var(--shadow)",
} as const;
const LEGEND_STYLE = { fontSize: 12, color: "var(--text-2)" } as const;

export function BacklinksTrendChart({
  data,
}: {
  data: BacklinksOverviewData["trends"];
}) {
  const { containerRef, chartWidth } = useChartWidth();

  if (data.length === 0) {
    return <EmptyChartState />;
  }

  return (
    <div
      ref={containerRef}
      className="h-56 min-w-0"
      aria-label="Backlink trend chart"
    >
      {chartWidth > 0 ? (
        <LineChart
          width={chartWidth}
          height={224}
          data={data}
          margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.12}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartTick}
            minTickGap={24}
            tick={AXIS_TICK}
            stroke={AXIS_LINE}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatAxisValue}
            width={60}
            tick={AXIS_TICK}
            stroke={AXIS_LINE}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatAxisValue}
            width={60}
            tick={AXIS_TICK}
            stroke={AXIS_LINE}
          />
          <Tooltip
            formatter={formatTooltipValue}
            labelFormatter={formatChartLabel}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="backlinks"
            stroke={SERIES.backlinks}
            strokeWidth={2}
            dot={false}
            name="Backlinks"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="referringDomains"
            stroke={SERIES.referringDomains}
            strokeWidth={2}
            dot={false}
            name="Referring domains"
          />
        </LineChart>
      ) : null}
    </div>
  );
}

export function BacklinksNewLostChart({
  data,
}: {
  data: BacklinksOverviewData["newLostTrends"];
}) {
  const { containerRef, chartWidth } = useChartWidth();

  if (data.length === 0) {
    return <EmptyChartState />;
  }

  return (
    <div
      ref={containerRef}
      className="h-56 min-w-0"
      aria-label="New and lost backlinks chart"
    >
      {chartWidth > 0 ? (
        <LineChart
          width={chartWidth}
          height={224}
          data={data}
          margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.12}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartTick}
            minTickGap={24}
            tick={AXIS_TICK}
            stroke={AXIS_LINE}
          />
          <YAxis
            tickFormatter={formatAxisValue}
            width={60}
            tick={AXIS_TICK}
            stroke={AXIS_LINE}
          />
          <Tooltip
            formatter={formatTooltipValue}
            labelFormatter={formatChartLabel}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Line
            type="monotone"
            dataKey="lostBacklinks"
            stroke={SERIES.lost}
            strokeWidth={2}
            dot={false}
            name="Lost backlinks"
          />
          <Line
            type="monotone"
            dataKey="newBacklinks"
            stroke={SERIES.gained}
            strokeWidth={2}
            dot={false}
            name="New backlinks"
          />
        </LineChart>
      ) : null}
    </div>
  );
}

function useChartWidth() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => {
      setChartWidth(container.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { containerRef, chartWidth };
}

/** Holds the chart's own height so a series arriving never shifts the card. */
function EmptyChartState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        height: 224,
        padding: "0 14px",
        border: "1px dashed var(--line)",
        borderRadius: 6,
        background: "var(--subtle)",
        textAlign: "center",
      }}
    >
      <span style={{ color: "var(--text-3)", display: "flex" }}>
        <Icon name="i-chart" size={18} />
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--text-2)",
        }}
      >
        Not enough history yet
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)" }}>
        Monthly snapshots build up from the first lookup. Nothing is backfilled
        for months we did not measure.
      </p>
    </div>
  );
}

function formatAxisValue(value: unknown) {
  if (typeof value !== "number") return "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function formatChartTick(value: unknown) {
  return typeof value === "string" ? formatMonthLabel(value) : "";
}

function formatChartLabel(value: unknown) {
  return typeof value === "string" ? formatCompactDate(value) : "";
}
