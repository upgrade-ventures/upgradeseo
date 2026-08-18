import { type CSSProperties, type ReactNode } from "react";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";
import {
  serpFeatureLabel,
  serpFeatureTooltip,
  toPath,
  toFullUrl,
} from "./RankTrackingTableParts";
import {
  Skeleton,
  TABLE,
  TABLE_SCROLLER,
  useInteractive,
} from "./RankScreenParts";

/**
 * The individual cells of the keyword table, and the sort they are ordered by.
 */

export type SortKey = "keyword" | "volume" | "kd" | "desktop" | "mobile";
export type SortState = { key: SortKey; asc: boolean };

export function SortHeader({
  sortKey,
  sort,
  onSort,
  style,
  title,
  children,
}: {
  sortKey: SortKey;
  sort: SortState;
  onSort: (next: SortState) => void;
  style: CSSProperties;
  title?: string;
  children: ReactNode;
}) {
  const { hovered, focused, interactiveProps } = useInteractive();
  const active = sort.key === sortKey;
  return (
    <th
      style={style}
      aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        title={title}
        onClick={() => onSort({ key: sortKey, asc: active ? !sort.asc : true })}
        {...interactiveProps}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          border: "none",
          background: "none",
          padding: 0,
          font: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          color: active || hovered ? "var(--text-2)" : "inherit",
          cursor: "pointer",
          outline: "none",
          boxShadow: focused ? "var(--focus)" : undefined,
        }}
      >
        {children}
        <span aria-hidden style={{ opacity: active ? 1 : 0 }}>
          {sort.asc ? "▴" : "▾"}
        </span>
      </button>
    </th>
  );
}

export function KeywordButton({
  keyword,
  onClick,
}: {
  keyword: string;
  onClick: () => void;
}) {
  const { hovered, focused, interactiveProps } = useInteractive();
  return (
    <button
      type="button"
      onClick={onClick}
      title="Position history"
      {...interactiveProps}
      style={{
        border: "none",
        background: "none",
        padding: 0,
        font: "inherit",
        fontWeight: 600,
        color: hovered ? "var(--accent)" : "var(--text)",
        textAlign: "left",
        cursor: "pointer",
        outline: "none",
        boxShadow: focused ? "var(--focus)" : undefined,
      }}
    >
      {keyword}
    </button>
  );
}

/**
 * One device's position.
 *
 * Four readings, and they must stay distinct: measured with a comparison,
 * measured for the first time, reported absent from the tracked depth, and
 * never measured at all.
 */
export function PositionCell({
  result,
  serpDepth,
}: {
  result: { position: number | null; previousPosition: number | null };
  serpDepth: number;
}) {
  const base: CSSProperties = {
    padding: "var(--rp,5px) 8px",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: ".01em",
  };
  const { position, previousPosition } = result;

  if (position === null) {
    return (
      <td style={{ ...base, color: "var(--text-3)" }}>
        {previousPosition === null ? "not measured" : `not in top ${serpDepth}`}
      </td>
    );
  }

  if (previousPosition === null) {
    return (
      <td style={base}>
        <span style={{ fontWeight: 600 }}>{position}</span>{" "}
        <span style={{ color: "var(--success)" }}>new</span>
      </td>
    );
  }

  const change = previousPosition - position;
  return (
    <td style={base}>
      <span style={{ fontWeight: 600 }}>{position}</span>{" "}
      {change === 0 ? (
        <span style={{ color: "var(--text-3)" }} aria-label="no change">
          —
        </span>
      ) : (
        <span
          style={{ color: change > 0 ? "var(--success)" : "var(--danger)" }}
          aria-label={`${change > 0 ? "up" : "down"} ${Math.abs(change)}`}
        >
          {change > 0 ? "▴" : "▾"}
          {Math.abs(change)}
        </span>
      )}
    </td>
  );
}

export function UrlCell({
  url,
  domain,
}: {
  url: string | null;
  domain: string;
}) {
  const { hovered, focused, interactiveProps } = useInteractive();
  if (!url) {
    // The empty variant drops the truncation rules on purpose: there is
    // nothing to truncate and the cell should not reserve 220px for a dash.
    return (
      <td style={{ padding: "var(--rp,5px) 8px", color: "var(--text-3)" }}>
        —
      </td>
    );
  }
  return (
    <td
      style={{
        padding: "var(--rp,5px) 8px",
        color: "var(--text-2)",
        maxWidth: 220,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      <a
        href={toFullUrl(url, domain)}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        {...interactiveProps}
        style={{
          color: "inherit",
          textDecoration: hovered ? "underline" : "none",
          outline: "none",
          boxShadow: focused ? "var(--focus)" : undefined,
        }}
      >
        {toPath(url)}
      </a>
    </td>
  );
}

export function SerpFeatures({ features }: { features: string[] }) {
  const known = features.filter(
    (feature) => serpFeatureLabel(feature) !== null,
  );
  if (known.length === 0) {
    return <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>;
  }
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {known.map((feature) => (
        <span
          key={feature}
          title={serpFeatureTooltip(feature)}
          style={{
            fontSize: 11,
            color: "var(--text-2)",
            background: "var(--inset)",
            border: "1px solid var(--line)",
            borderRadius: 5,
            padding: "0 5px",
          }}
        >
          {serpFeatureLabel(feature)}
        </span>
      ))}
    </span>
  );
}

export function TableSkeleton({
  showDesktop,
  showMobile,
}: {
  showDesktop: boolean;
  showMobile: boolean;
}) {
  const columns = 5 + (showDesktop ? 1 : 0) + (showMobile ? 1 : 0);
  return (
    <div style={TABLE_SCROLLER} aria-busy>
      <table style={TABLE}>
        <tbody>
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              style={{ borderBottom: "1px solid var(--border-muted)" }}
            >
              {Array.from({ length: columns }).map((__, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    padding:
                      cellIndex === 0
                        ? "9px 8px 9px var(--pad,24px)"
                        : "9px 8px",
                  }}
                >
                  <Skeleton width={cellIndex === 1 ? "60%" : "40%"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sortValue(row: RankTrackingRow, key: SortKey): number | string | null {
  if (key === "keyword") return row.keyword;
  if (key === "volume") return row.searchVolume;
  if (key === "kd") return row.keywordDifficulty;
  return row[key].position;
}

export function sortRows(
  rows: RankTrackingRow[],
  sort: SortState,
): RankTrackingRow[] {
  return rows.toSorted((a, b) => {
    const left = sortValue(a, sort.key);
    const right = sortValue(b, sort.key);
    // Unknown values sort last in both directions: an absent position is not a
    // very good or a very bad one.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    const order =
      typeof left === "string" && typeof right === "string"
        ? left.localeCompare(right)
        : Number(left) - Number(right);
    return sort.asc ? order : -order;
  });
}
