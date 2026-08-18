import { useState } from "react";
import { NoValue } from "@/client/components/prominence/Primitives";
import type { AuditResultsData } from "@/client/features/audit/results/types";
import type { IssueSeverity } from "@/shared/audit-issues";

export type AuditIssueRow = AuditResultsData["issues"][number];

/** The design's outer page gutter, used by the first and last table column. */
export const EDGE = "var(--pad, 24px)";

/** One affected page, with its `detailsJson` already unpacked. */
export type IssueDetailRow = {
  issue: AuditIssueRow;
  details: IssueRowDetails;
};

export type IssueRowDetails = {
  /** The link target the crawler could not reach, when the check records one. */
  target: string | null;
  /** The status the crawler saw, for the target or for the page itself. */
  status: number | null;
  /** Everything else the check recorded, rendered as the issues list renders it. */
  rest: string | null;
};

export const SEVERITY_COLOR: Record<
  IssueSeverity,
  { fg: string; soft: string; border: string }
> = {
  critical: {
    fg: "var(--danger)",
    soft: "var(--danger-soft)",
    border: "var(--danger-border)",
  },
  warning: {
    fg: "var(--warning)",
    soft: "var(--warning-soft)",
    border: "var(--warning-border)",
  },
  info: {
    fg: "var(--info)",
    soft: "var(--info-soft)",
    border: "var(--info-border)",
  },
};

export function parseRowDetails(detailsJson: string | null): IssueRowDetails {
  const empty: IssueRowDetails = { target: null, status: null, rest: null };
  if (!detailsJson) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(detailsJson);
  } catch {
    return empty;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return empty;
  }

  // The guard above already proved this is a plain object; spreading gives an
  // indexable type without asserting one.
  const record: Record<string, unknown> = { ...parsed };
  const rawStatus = record.targetStatus ?? record.statusCode;
  const rest = Object.entries(record)
    .filter(
      ([key, value]) =>
        value != null &&
        key !== "targetUrl" &&
        key !== "targetStatus" &&
        key !== "statusCode",
    )
    .map(
      ([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(" → ") : String(value)}`,
    )
    .join(" · ");

  return {
    target: typeof record.targetUrl === "string" ? record.targetUrl : null,
    status: typeof rawStatus === "number" ? rawStatus : null,
    rest: rest === "" ? null : rest,
  };
}

/**
 * Which of the design's columns this issue type can actually fill.
 *
 * The design draws the broken-link table, whose middle columns only exist for
 * link-shaped issues. A missing-title row has no target and no anchor, so those
 * columns are dropped rather than filled with placeholders.
 */
export type AffectedColumns = {
  target: boolean;
  anchor: boolean;
  rest: boolean;
  status: boolean;
};

export function affectedColumns(rows: IssueDetailRow[]): AffectedColumns {
  const target = rows.some((row) => row.details.target !== null);
  return {
    target,
    anchor: target,
    rest: rows.some((row) => row.details.rest !== null),
    status: rows.some((row) => row.details.status !== null),
  };
}

export function WhatThisMeansCallout({
  severity,
  explanation,
}: {
  severity: IssueSeverity;
  explanation: string;
}) {
  const tone = SEVERITY_COLOR[severity];

  return (
    <div
      style={{
        margin: `16px ${EDGE}`,
        padding: "11px 13px",
        border: "1px solid var(--line)",
        borderLeft: `3px solid ${tone.fg}`,
        borderRadius: 6,
        background: tone.soft,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>
        What this means
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
        {explanation}
      </p>
    </div>
  );
}

const SIDEBAR_LABEL = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-3)",
  fontWeight: 700,
} satisfies React.CSSProperties;

export function IssueAside({
  stacked,
  severity,
  pageCount,
  crawlId,
  children,
}: {
  /** Below 1140 the rail stacks under the table and re-borders to the top. */
  stacked: boolean;
  severity: IssueSeverity;
  pageCount: number;
  crawlId: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      style={{
        borderLeft: stacked ? "none" : "1px solid var(--line)",
        borderTop: stacked ? "1px solid var(--line)" : "none",
        alignSelf: "stretch",
        minHeight: "100%",
        padding: 14,
      }}
    >
      <div style={SIDEBAR_LABEL}>Status</div>
      {/* The design reads "Open · 12 pages". Nothing here tracks an issue
          across crawls, so this states the fact we hold: it was present when
          this crawl ran. */}
      <div
        style={{
          marginTop: 4,
          fontSize: 13,
          fontWeight: 600,
          color: SEVERITY_COLOR[severity].fg,
        }}
      >
        Present in this crawl · {pageCount} {pageCount === 1 ? "page" : "pages"}
      </div>

      <div style={{ ...SIDEBAR_LABEL, marginTop: 14 }}>Fix effort</div>
      {/* The design rates effort ("Low — editing 12 links"). Nothing in the
          crawl measures that, so the rail says so rather than guessing. */}
      <div
        title="UpgradeSEO does not estimate fix effort"
        style={{ marginTop: 4, fontSize: 13 }}
      >
        <NoValue />
      </div>

      <div style={{ ...SIDEBAR_LABEL, marginTop: 14 }}>Found in</div>
      <div
        title={crawlId}
        style={{
          marginTop: 4,
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
        }}
      >
        {shortCrawlId(crawlId)}
      </div>

      <div
        style={{
          ...SIDEBAR_LABEL,
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid var(--border-muted)",
        }}
      >
        History
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </aside>
  );
}

/** Crawls have UUIDs, not the design's short "AUD-2411" ids. Show the prefix
 *  and keep the full id in the title attribute. */
export function shortCrawlId(auditId: string): string {
  return auditId.split("-")[0] ?? auditId;
}

/**
 * A timeline entry.
 *
 * The design draws this twice with slightly different metrics (the rail indent,
 * the row gap, the dot offset and the meta line's letter-spacing all differ
 * between the aside and the History tab). Both are reproduced as drawn.
 */
export function TimelineItem({
  variant,
  color,
  label,
  meta,
  last,
}: {
  variant: "aside" | "tab";
  color: string;
  label: string;
  meta?: string;
  last?: boolean;
}) {
  const aside = variant === "aside";

  return (
    <div
      style={{
        position: "relative",
        paddingLeft: aside ? 14 : 15,
        paddingBottom: last ? undefined : aside ? 11 : 13,
        borderLeft: "1px solid var(--line)",
        marginLeft: 4,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: -4,
          top: aside ? 3 : 4,
          width: 7,
          height: 7,
          borderRadius: 999,
          background: color,
          border: "2px solid var(--surface)",
        }}
      />
      <div style={{ fontSize: 12.5 }}>{label}</div>
      {meta ? (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: aside ? "0.01em" : undefined,
          }}
        >
          {meta}
        </div>
      ) : null}
    </div>
  );
}

/** The design's bordered strip with a leading info dot. */
export function InfoStrip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        margin: `14px ${EDGE}`,
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

/**
 * The design's back link and "show the rest" are `<a>` elements with no href,
 * so neither is focusable or operable from a keyboard. They are buttons here,
 * painted as links, with the hover underline and the focus ring the design
 * leaves undefined.
 */
export function LinkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        padding: 0,
        border: "none",
        background: "none",
        font: "inherit",
        fontSize: 12.5,
        color: "var(--accent)",
        cursor: "pointer",
        textDecoration: hovered ? "underline" : "none",
        borderRadius: 4,
        outline: "none",
        boxShadow: focused ? "var(--focus)" : "none",
      }}
    >
      {children}
    </button>
  );
}
