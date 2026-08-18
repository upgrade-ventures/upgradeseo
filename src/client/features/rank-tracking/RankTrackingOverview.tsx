import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { getRankConfigTrend } from "@/serverFunctions/rank-tracking";
import {
  formatDateTick,
  TrendRangeToggle,
  useChartWidth,
} from "./RankTrackingTrendChart";
import { Dash, Skeleton } from "./RankScreenParts";
import { CHART_TICK, ChartTooltipBox } from "./RankChartParts";

// Token colours rather than hex: the chart has to survive the theme swap the
// same way the rest of the screen does.
const BUCKETS = [
  { key: "top3", label: "Top 3", color: "var(--success)" },
  { key: "top4to10", label: "4–10", color: "var(--accent)" },
  { key: "top11to20", label: "11–20", color: "var(--warning)" },
  { key: "notRanking", label: "Not in top 20", color: "var(--text-3)" },
] as const;

/** Narrowed recharts tooltip payload entry (typed `any` upstream). */
interface PayloadEntry {
  dataKey?: string | number;
  value?: number | string | null;
}

export function RankTrackingOverview({
  device,
  projectId,
  configId,
}: {
  device: "desktop" | "mobile";
  projectId: string;
  configId: string;
}) {
  const [sinceDays, setSinceDays] = useState(730);

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ["rankConfigTrend", projectId, configId, device, sinceDays],
    queryFn: () =>
      getRankConfigTrend({
        data: { projectId, configId, device, sinceDays },
      }),
  });

  const chartData = useMemo(
    () =>
      (trend ?? []).map((p) => ({
        checkedAt: new Date(p.checkedAt).getTime(),
        top3: p.top3,
        top4to10: p.top4to10,
        top11to20: p.top11to20,
        notRanking: p.notRanking,
      })),
    [trend],
  );

  const { containerRef, width } = useChartWidth();

  return (
    <div style={{ padding: "16px var(--pad,24px) 0" }}>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "var(--surface)",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            Position distribution
          </h2>
          <TrendRangeToggle value={sinceDays} onChange={setSinceDays} />
        </div>

        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}
          aria-hidden
        >
          {BUCKETS.map((b) => (
            <span
              key={b.key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "var(--text-2)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: b.color,
                }}
              />
              {b.label}
            </span>
          ))}
        </div>

        {trendLoading ? (
          // A skeleton the size of the plot, so the card does not collapse and
          // then jump back to 220px when the trend arrives.
          <div
            aria-busy
            aria-label="Loading the position distribution"
            style={{ marginTop: 8 }}
          >
            <Skeleton width="100%" height={220} />
          </div>
        ) : chartData.length <= 1 ? (
          <div
            style={{
              padding: "26px 12px",
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            {chartData.length === 0
              ? "No completed check has recorded a position yet, so there is no trend to draw."
              : "One check so far. The trend starts after the next one."}
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{ width: "100%", minWidth: 0, height: 220 }}
          >
            {width > 0 ? (
              <AreaChart
                width={width}
                height={220}
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  opacity={0.1}
                  vertical={false}
                />
                <XAxis
                  dataKey="checkedAt"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={formatDateTick}
                  tick={CHART_TICK}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis
                  allowDecimals={false}
                  tick={CHART_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  content={(props: TooltipContentProps<number, string>) => {
                    const { active, payload, label } = props;
                    if (
                      !active ||
                      !payload?.length ||
                      typeof label !== "number"
                    ) {
                      return null;
                    }
                    const byKey = new Map(
                      payload.map((p: PayloadEntry) => [
                        String(p.dataKey),
                        typeof p.value === "number" ? p.value : 0,
                      ]),
                    );
                    return <DistributionTooltip label={label} byKey={byKey} />;
                  }}
                  cursor={{ stroke: "var(--border-strong)" }}
                />
                {BUCKETS.map((b) => (
                  <Area
                    key={b.key}
                    type="monotone"
                    dataKey={b.key}
                    name={b.label}
                    stackId="positions"
                    stroke={b.color}
                    fill={b.color}
                    fillOpacity={0.7}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function DistributionTooltip({
  label,
  byKey,
}: {
  label: number;
  byKey: Map<string, number>;
}) {
  return (
    <ChartTooltipBox>
      <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 3 }}>
        {new Date(label).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>
      {BUCKETS.map((b) => (
        <div
          key={b.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: b.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: "var(--text-2)" }}>{b.label}:</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {/* The payload always carries every stacked bucket, so a missing
                key is a recharts shape change rather than an unmeasured value. */}
            {byKey.get(b.key) ?? <Dash />}
          </span>
        </div>
      ))}
    </ChartTooltipBox>
  );
}
