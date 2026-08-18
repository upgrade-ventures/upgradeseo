import { useState } from "react";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import {
  formatCount,
  formatCtr,
  formatPosition,
} from "@/client/features/search-performance/SearchPerformanceColumns";

/**
 * The Search Performance breakdown table.
 *
 * The design draws this table twice with deliberately different rules: inside
 * the Queries card it is unfilled-header, 12px-guttered and tabular-numeric,
 * while the Pages/Countries/Devices tables are full-bleed, subtle-headed and
 * gutter-aligned to `--pad`. That difference is specified, not accidental, so
 * both live here behind `variant` rather than being smoothed into one look.
 */

type DeltaTone = "success" | "danger" | "neutral";

export type PerformanceRow = {
  /** Stable row identity and the exported value. */
  key: string;
  /** What the first cell shows; may be a shortened form of `key`. */
  label: string;
  /** Full value behind a shortened label. */
  labelTitle?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /**
   * Period-over-period click change. Absent whenever the source cannot supply
   * a previous period for this row: an omitted delta means "not measured",
   * never "no change".
   */
  delta?: { text: string; tone: DeltaTone };
};

export type TableStatus = "ready" | "loading" | "error";

type Variant = "card" | "bleed";

const NUMERIC_COLUMNS: { id: string; label: string }[] = [
  { id: "clicks", label: "Clicks" },
  { id: "impressions", label: "Impressions" },
  { id: "ctr", label: "CTR" },
  { id: "position", label: "Position" },
];

const HEAD_CELL = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-3)",
} satisfies React.CSSProperties;

const DELTA_COLOR: Record<DeltaTone, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  neutral: "var(--text-3)",
};

/** Horizontal padding of the first column: the card table indents like its
 *  card, the full-bleed tables line up with the page gutter. */
function labelGutter(variant: Variant): string {
  return variant === "card" ? "12px" : "var(--pad, 24px)";
}

export function PerformanceTable({
  variant,
  labelHeader,
  rows,
  status,
  errorMessage,
  onRetry,
  emptyMessage,
}: {
  variant: Variant;
  labelHeader: string;
  rows: PerformanceRow[];
  status: TableStatus;
  errorMessage?: string;
  onRetry?: () => void;
  emptyMessage: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table
        style={{
          width: "100%",
          minWidth: 560,
          borderCollapse: "collapse",
          fontSize: 12.5,
        }}
      >
        <thead>
          <tr
            style={
              variant === "card"
                ? { borderBottom: "1px solid var(--border-muted)" }
                : {
                    background: "var(--subtle)",
                    borderBottom: "1px solid var(--line)",
                  }
            }
          >
            <th
              style={{
                ...HEAD_CELL,
                textAlign: "left",
                padding: `6px ${labelGutter(variant)}`,
              }}
            >
              {labelHeader}
            </th>
            {NUMERIC_COLUMNS.map((column) => (
              <th
                key={column.id}
                style={{
                  ...HEAD_CELL,
                  textAlign: "right",
                  padding: "6px 12px",
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {status === "loading" ? (
            <SkeletonRows variant={variant} />
          ) : status === "error" ? (
            <MessageRow variant={variant}>
              <ErrorPanel message={errorMessage} onRetry={onRetry} />
            </MessageRow>
          ) : rows.length === 0 ? (
            <MessageRow variant={variant}>
              <p style={{ margin: 0, color: "var(--text-2)" }}>
                {emptyMessage}
              </p>
            </MessageRow>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.key}
                onMouseEnter={() => setHovered(row.key)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background:
                    hovered === row.key ? "var(--subtle)" : "transparent",
                  // The design leaves the card table's last row unruled so the
                  // border does not double up with the card edge.
                  borderBottom:
                    variant === "card" && index === rows.length - 1
                      ? undefined
                      : "1px solid var(--border-muted)",
                }}
              >
                <td
                  title={row.labelTitle ?? row.label}
                  style={{
                    padding: `var(--rp, 5px) ${labelGutter(variant)}`,
                    textAlign: "left",
                    fontWeight: 600,
                  }}
                >
                  {row.label}
                </td>
                <NumericCell variant={variant} strong>
                  {formatCount(row.clicks)}
                  {row.delta ? (
                    <>
                      {" "}
                      <span style={{ color: DELTA_COLOR[row.delta.tone] }}>
                        {row.delta.text}
                      </span>
                    </>
                  ) : null}
                </NumericCell>
                <NumericCell variant={variant}>
                  {formatCount(row.impressions)}
                </NumericCell>
                <NumericCell variant={variant}>
                  {formatCtr(row.ctr)}
                </NumericCell>
                <NumericCell variant={variant} strong>
                  {formatPosition(row.position)}
                </NumericCell>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * `strong` marks the columns the design leaves at full text colour on the card
 * table (clicks and position); everything else is muted. The full-bleed tables
 * mute every numeric column, so the flag is ignored there.
 *
 * Tabular numerals are on every numeric column of both variants: the design's
 * breakdown fixtures omit them, but a figure column that does not line up is a
 * defect, and the foundations rule is one rule for all numeric columns.
 */
function NumericCell({
  variant,
  strong,
  children,
}: {
  variant: Variant;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: "var(--rp, 5px) 12px",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.01em",
        color: variant === "card" && strong ? undefined : "var(--text-2)",
      }}
    >
      {children}
    </td>
  );
}

function MessageRow({
  variant,
  children,
}: {
  variant: Variant;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={5}
        style={{
          padding: `20px ${labelGutter(variant)}`,
          fontSize: 12.5,
        }}
      >
        {children}
      </td>
    </tr>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      // Announced when the table swaps to it, since nothing else on the screen
      // moves to say the rows failed.
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "9px 12px",
        border: "1px solid var(--danger-border)",
        borderRadius: 8,
        background: "var(--danger-soft)",
        color: "var(--danger)",
      }}
    >
      <span>{message ?? "Search Console did not answer."}</span>
      {onRetry ? (
        <SecondaryButton icon="i-refresh" onClick={onRetry}>
          Try again
        </SecondaryButton>
      ) : null}
    </div>
  );
}

const SKELETON_ROW_COUNT = 8;

function SkeletonRows({ variant }: { variant: Variant }) {
  return (
    <>
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
        <tr
          key={index}
          aria-hidden="true"
          style={{ borderBottom: "1px solid var(--border-muted)" }}
        >
          <td
            style={{
              padding: `var(--rp, 5px) ${labelGutter(variant)}`,
            }}
          >
            <SkeletonBar width="60%" />
          </td>
          {NUMERIC_COLUMNS.map((column) => (
            <td
              key={column.id}
              style={{ padding: "var(--rp, 5px) 12px", textAlign: "right" }}
            >
              <SkeletonBar width={52} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonBar({
  width,
  height = 12,
}: {
  width: number | string;
  height?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius: 4,
        background: "var(--inset)",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

/** The design's bordered note under the Pages and Devices tables. */
export function FootnoteCallout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        margin: "14px var(--pad, 24px)",
        padding: "9px 12px",
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--subtle)",
        fontSize: 12.5,
        color: "var(--text-2)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: "var(--info)",
          flexShrink: 0,
          marginTop: 5,
        }}
      />
      <span>{children}</span>
    </div>
  );
}
