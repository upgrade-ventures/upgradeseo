import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCount } from "@/client/features/ai-search/platformLabels";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

type Props = {
  result: BrandLookupResult;
};

export function BrandLookupMentionTrendCard({ result }: Props) {
  const chartData = useMemo(
    () =>
      result.monthlyVolume.map((entry) => ({
        label: `${entry.year}-${String(entry.month).padStart(2, "0")}`,
        volume: entry.volume ?? 0,
      })),
    [result.monthlyVolume],
  );

  if (chartData.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          height: 224,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12.5,
          color: "var(--text-2)",
        }}
      >
        No month by month history in this measurement.
      </div>
    );
  }

  return (
    <div style={{ height: 224 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.12}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<MentionTooltip />}
            cursor={{ stroke: "currentColor", strokeOpacity: 0.2 }}
          />
          <Line
            type="monotone"
            dataKey="volume"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MentionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        borderRadius: 6,
        border: "1px solid var(--line)",
        background: "var(--overlay)",
        padding: "6px 10px",
        boxShadow: "var(--shadow)",
      }}
    >
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-3)" }}>
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatCount(payload[0].value)} mentions
      </p>
    </div>
  );
}
