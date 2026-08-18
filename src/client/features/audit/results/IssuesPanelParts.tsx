import {
  ChipCount,
  FilterChip,
  RowChevron,
  Skeleton,
} from "@/client/features/audit/AuditParts";
import {
  focusRing,
  LIST_ROW,
  ROW_COUNT,
  ROW_DESCRIPTION,
  ROW_DOT,
  ROW_TITLE,
  severityColor,
  SUMMARY_CAPTION,
  SUMMARY_CELL,
  SUMMARY_CELL_LAST,
  SUMMARY_LABEL,
  SUMMARY_NUMBER,
  SUMMARY_VALUE_ROW,
  useHover,
} from "@/client/features/audit/auditStyles";
import type { IssueGroup } from "@/client/features/audit/results/issueGrouping";
import type { useCrawlComparison } from "@/client/features/audit/results/useCrawlComparison";

/** The parts of the issues tab that are one control each. */

export function SummaryCell({
  label,
  value,
  color,
  caption,
  last,
}: {
  label: string;
  value: number;
  color?: string;
  caption: string;
  last?: boolean;
}) {
  return (
    <div style={last ? SUMMARY_CELL_LAST : SUMMARY_CELL}>
      <div style={SUMMARY_LABEL}>{label}</div>
      <div style={SUMMARY_VALUE_ROW}>
        <span style={{ ...SUMMARY_NUMBER, color }}>
          {value.toLocaleString()}
        </span>
        <span style={SUMMARY_CAPTION}>{caption}</span>
      </div>
    </div>
  );
}

/**
 * A chip whose count only exists once the previous crawl has been read. It
 * never shows a zero it has not measured: with no earlier crawl the chip is
 * disabled and says so, and while the comparison loads it shows a placeholder.
 */
export function ComparisonChip({
  active,
  label,
  count,
  comparison,
  previousCrawlLabel,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number | null;
  comparison: ReturnType<typeof useCrawlComparison>;
  previousCrawlLabel: string | null;
  onClick: () => void;
}) {
  const title = !comparison.isAvailable
    ? "No earlier completed crawl to compare against"
    : comparison.isError
      ? "The previous crawl could not be loaded"
      : previousCrawlLabel
        ? `Compared with ${previousCrawlLabel}`
        : undefined;

  return (
    <FilterChip
      active={active}
      disabled={!comparison.isAvailable}
      title={title}
      onClick={onClick}
    >
      {label}
      {count !== null ? (
        <ChipCount>{count}</ChipCount>
      ) : comparison.isLoading ? (
        <ChipCount>
          <Skeleton
            width={14}
            height={8}
            style={{ display: "inline-block", verticalAlign: "middle" }}
          />
        </ChipCount>
      ) : null}
    </FilterChip>
  );
}

/**
 * One issue type.
 *
 * The design's row is an `<a>` with no href, which no keyboard can reach. It is
 * a button here, opening the same issue detail screen the design routes to.
 */
export function IssueRow({
  group,
  isNew,
  fixed,
  last,
  onOpen,
}: {
  group: IssueGroup;
  isNew?: boolean;
  fixed?: boolean;
  last?: boolean;
  onOpen: (group: IssueGroup) => void;
}) {
  const { hovered, hoverProps } = useHover();
  const dotColor = fixed ? "var(--text-3)" : severityColor(group.severity);

  return (
    <button
      type="button"
      onClick={() => onOpen(group)}
      {...hoverProps}
      {...focusRing<HTMLButtonElement>()}
      style={{
        ...LIST_ROW,
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        border: "none",
        borderBottom: last ? "none" : "1px solid var(--border-muted)",
        background: hovered ? "var(--subtle)" : "transparent",
        cursor: "pointer",
        outline: "none",
      }}
    >
      <span style={{ ...ROW_DOT, background: dotColor }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...ROW_TITLE, display: "block" }}>{group.title}</span>
        {group.explanation ? (
          <span style={{ ...ROW_DESCRIPTION, display: "block" }}>
            {group.explanation}
          </span>
        ) : null}
      </span>
      {isNew ? <NewBadge /> : null}
      <span style={ROW_COUNT}>
        {group.pagesAffected.toLocaleString()}{" "}
        {group.pagesAffected === 1 ? "page" : "pages"}
      </span>
      <RowChevron />
    </button>
  );
}

function NewBadge() {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--danger)",
        background: "var(--danger-soft)",
        border: "1px solid var(--danger-border)",
        borderRadius: 999,
        padding: "1px 7px",
        whiteSpace: "nowrap",
      }}
    >
      New
    </span>
  );
}
