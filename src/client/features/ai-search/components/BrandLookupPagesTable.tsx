import { useState } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { NoValue } from "@/client/components/prominence/Primitives";
import { useFocusRing } from "@/client/features/ai-search/components/aiControls";
import {
  FIRST_CELL,
  HEAD_CELL_STYLE,
  HEAD_ROW_STYLE,
  LAST_CELL,
  MID_CELL,
  MessageRow,
  PromptLink,
  SortHeader,
  TABLE_STYLE,
  TableScroller,
  useHoveredRow,
  type SortState,
} from "@/client/features/ai-search/components/aiTableParts";
import {
  formatCount,
  formatPlatformLabel,
} from "@/client/features/ai-search/platformLabels";
import { formatUrlForDisplay } from "@/client/components/table/url";
import type { BrandLookupResult } from "@/types/schemas/ai-search";

type TopPageRow = BrandLookupResult["topPages"][number];

/**
 * Pages cited alongside the brand. The design draws no such table; it is built
 * out of the design's own full-bleed table so the two read as one screen.
 */
export function BrandLookupPagesTable({
  rows,
  targetDomain,
  projectId,
  brand,
  showPlatform,
  sort,
  onSortChange,
  emptyMessage,
}: {
  rows: TopPageRow[];
  targetDomain: string | null;
  projectId: string;
  brand: string;
  showPlatform: boolean;
  sort: SortState;
  onSortChange: (next: SortState) => void;
  emptyMessage: string;
}) {
  const { rowProps } = useHoveredRow();
  const columnCount = showPlatform ? 4 : 3;

  return (
    <TableScroller>
      <table style={TABLE_STYLE}>
        <thead>
          <tr style={HEAD_ROW_STYLE}>
            <th
              scope="col"
              style={{
                ...HEAD_CELL_STYLE,
                textAlign: "left",
                padding: "6px var(--pad, 24px)",
              }}
            >
              Source
            </th>
            {showPlatform ? (
              <th
                scope="col"
                style={{
                  ...HEAD_CELL_STYLE,
                  textAlign: "left",
                  padding: "6px 12px",
                }}
              >
                Model
              </th>
            ) : null}
            <th
              scope="col"
              style={{
                ...HEAD_CELL_STYLE,
                textAlign: "left",
                padding: "6px 12px",
              }}
            >
              Cited for
            </th>
            <th
              scope="col"
              aria-sort={sort.desc ? "descending" : "ascending"}
              style={{
                ...HEAD_CELL_STYLE,
                textAlign: "right",
                padding: "6px var(--pad, 24px) 6px 12px",
              }}
            >
              <SortHeader
                label="Source vol."
                desc={sort.desc}
                onToggle={() => onSortChange({ desc: !sort.desc })}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <MessageRow colSpan={columnCount}>{emptyMessage}</MessageRow>
          ) : (
            rows.map((row) => {
              const key = `${row.platform}:${row.url}`;
              return (
                <tr key={key} {...rowProps(key)}>
                  <td style={{ ...FIRST_CELL, verticalAlign: "top" }}>
                    <PageLink row={row} targetDomain={targetDomain} />
                  </td>
                  {showPlatform ? (
                    <td style={{ ...MID_CELL, verticalAlign: "top" }}>
                      {formatPlatformLabel(row.platform)}
                    </td>
                  ) : null}
                  <td style={{ ...MID_CELL, verticalAlign: "top" }}>
                    <CitedForCell
                      keywords={row.keywords}
                      projectId={projectId}
                      brand={brand}
                    />
                  </td>
                  <td style={{ ...LAST_CELL, verticalAlign: "top" }}>
                    {row.capturedVolume == null ? (
                      <NoValue />
                    ) : (
                      formatCount(row.capturedVolume)
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </TableScroller>
  );
}

function urlPath(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const path = `${url.pathname}${url.search}`;
    return path === "/" ? "" : path;
  } catch {
    return "";
  }
}

function normalizeDomain(value: string): string {
  return value.replace(/^www\./i, "").toLowerCase();
}

/**
 * The lookup covers subdomains, so the target's own pages can surface under any
 * of them (docs.acme.com for acme.com) and must carry the "You" marker too.
 */
function isTargetDomain(domain: string, targetDomain: string): boolean {
  const candidate = normalizeDomain(domain);
  const target = normalizeDomain(targetDomain);
  return candidate === target || candidate.endsWith(`.${target}`);
}

function PageLink({
  row,
  targetDomain,
}: {
  row: TopPageRow;
  targetDomain: string | null;
}) {
  const { ring, ringProps } = useFocusRing();
  const path = urlPath(row.url);
  const isOwn =
    targetDomain != null &&
    row.domain != null &&
    isTargetDomain(row.domain, targetDomain);

  return (
    <a
      href={row.url}
      target="_blank"
      rel="noreferrer"
      {...ringProps}
      style={{
        display: "block",
        maxWidth: 460,
        color: "inherit",
        borderRadius: 4,
        ...ring,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {row.domain ?? formatUrlForDisplay(row.url)}
        {isOwn ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
              background: "var(--accent-soft)",
              borderRadius: 999,
              padding: "0 6px",
            }}
          >
            You
          </span>
        ) : null}
        <Icon name="i-external" size={11} />
      </span>
      {path ? (
        <span
          style={{
            display: "block",
            fontSize: 11.5,
            fontWeight: 400,
            color: "var(--text-3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {path}
        </span>
      ) : null}
    </a>
  );
}

const CITED_FOR_PREVIEW = 3;

/** The prompts whose answers cited this page, three at a time. */
function CitedForCell({
  keywords,
  projectId,
  brand,
}: {
  keywords: TopPageRow["keywords"];
  projectId: string;
  brand: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { ring, ringProps } = useFocusRing();

  if (keywords.length === 0) {
    return <span style={{ color: "var(--text-3)" }}>—</span>;
  }

  const visible = expanded ? keywords : keywords.slice(0, CITED_FOR_PREVIEW);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {visible.map((keyword) => (
        <span
          key={keyword.question}
          style={{ display: "flex", gap: 8, alignItems: "baseline" }}
        >
          <PromptLink
            projectId={projectId}
            question={keyword.question}
            brand={brand}
          />
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-3)",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {keyword.aiSearchVolume == null
              ? "vol. not reported"
              : `${formatCount(keyword.aiSearchVolume)} vol.`}
          </span>
        </span>
      ))}
      {keywords.length > CITED_FOR_PREVIEW ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          {...ringProps}
          style={{
            alignSelf: "flex-start",
            border: "none",
            background: "none",
            padding: 0,
            fontFamily: "inherit",
            fontSize: 11.5,
            color: "var(--text-3)",
            cursor: "pointer",
            borderRadius: 4,
            ...ring,
          }}
        >
          {expanded
            ? "Show less"
            : `+${keywords.length - CITED_FOR_PREVIEW} more`}
        </button>
      ) : null}
    </div>
  );
}
