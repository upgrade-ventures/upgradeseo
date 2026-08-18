import { useState } from "react";
import { NoValue } from "@/client/components/prominence/Primitives";
import { extractPathname } from "@/client/features/audit/shared";
import {
  EDGE,
  SEVERITY_COLOR,
  type AffectedColumns,
  type IssueDetailRow,
} from "@/client/features/audit/issue/IssueDetailParts";

const HEAD_CELL = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-3)",
} satisfies React.CSSProperties;

export function AffectedPagesTable({
  rows,
  columns,
}: {
  rows: IssueDetailRow[];
  columns: AffectedColumns;
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
            style={{
              background: "var(--subtle)",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <th
              style={{
                ...HEAD_CELL,
                textAlign: "left",
                padding: `6px ${EDGE}`,
              }}
            >
              {columns.target ? "Page with the link" : "Affected page"}
            </th>
            {columns.target ? (
              <th
                style={{ ...HEAD_CELL, textAlign: "left", padding: "6px 12px" }}
              >
                Broken target
              </th>
            ) : null}
            {columns.anchor ? (
              <th
                style={{ ...HEAD_CELL, textAlign: "left", padding: "6px 12px" }}
              >
                Anchor text
              </th>
            ) : null}
            {columns.rest ? (
              <th
                style={{ ...HEAD_CELL, textAlign: "left", padding: "6px 12px" }}
              >
                What we found
              </th>
            ) : null}
            {columns.status ? (
              <th
                style={{
                  ...HEAD_CELL,
                  textAlign: "right",
                  padding: `6px ${EDGE} 6px 12px`,
                }}
              >
                Status
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.issue.id}
              onMouseEnter={() => setHovered(row.issue.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background:
                  hovered === row.issue.id ? "var(--subtle)" : "transparent",
                borderBottom:
                  index === rows.length - 1
                    ? undefined
                    : "1px solid var(--border-muted)",
              }}
            >
              <td
                style={{
                  padding: `var(--rp, 5px) ${EDGE}`,
                  fontWeight: 600,
                }}
              >
                {/* The design's cell is plain text; the issues list opened the
                    page in a new tab, and that is worth keeping. Colour stays
                    inherited so the table still reads as the design draws it. */}
                <a
                  href={row.issue.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={row.issue.pageUrl}
                  style={{
                    color: "inherit",
                    textDecoration:
                      hovered === row.issue.id ? "underline" : "none",
                  }}
                >
                  {extractPathname(row.issue.pageUrl)}
                </a>
              </td>
              {columns.target ? (
                <td
                  title={row.details.target ?? undefined}
                  style={{
                    padding: "var(--rp, 5px) 12px",
                    color: "var(--text-2)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0.01em",
                  }}
                >
                  {row.details.target ? (
                    extractPathname(row.details.target)
                  ) : (
                    <NoValue />
                  )}
                </td>
              ) : null}
              {columns.anchor ? (
                <td
                  style={{
                    padding: "var(--rp, 5px) 12px",
                    color: "var(--text-2)",
                  }}
                >
                  {/* The crawler keeps link anchors only for the duration of the
                      crawl, so no anchor text survives into the issue rows. */}
                  <NoValue />
                </td>
              ) : null}
              {columns.rest ? (
                <td
                  style={{
                    padding: "var(--rp, 5px) 12px",
                    color: "var(--text-2)",
                  }}
                >
                  {row.details.rest ?? <NoValue />}
                </td>
              ) : null}
              {columns.status ? (
                <td
                  style={{
                    padding: `var(--rp, 5px) ${EDGE} var(--rp, 5px) 12px`,
                    textAlign: "right",
                  }}
                >
                  {row.details.status == null ? (
                    <NoValue />
                  ) : (
                    <StatusCodeChip code={row.details.status} />
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The design chips 404 and 410 identically in danger. Other codes reach this
 * table too (5xx pages, redirect hops), so the chip follows the code's class
 * rather than painting every status as a failure.
 */
function StatusCodeChip({ code }: { code: number }) {
  const tone =
    code >= 400
      ? SEVERITY_COLOR.critical
      : code >= 300
        ? SEVERITY_COLOR.warning
        : SEVERITY_COLOR.info;

  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.01em",
        fontSize: 11.5,
        fontWeight: 600,
        color: tone.fg,
        background: tone.soft,
        border: `1px solid ${tone.border}`,
        borderRadius: 5,
        padding: "1px 6px",
      }}
    >
      {code}
    </span>
  );
}
