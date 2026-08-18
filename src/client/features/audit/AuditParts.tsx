import { useState, type CSSProperties, type ReactNode } from "react";
import {
  focusRing,
  TH_LEAD,
  TH_NUMERIC,
  useHover,
} from "@/client/features/audit/auditStyles";

/* ── Filter chip ──────────────────────────────────────────────────────────── */

/**
 * Pill toggle in the issues filter bar.
 *
 * Single-select in the design despite the `aria-pressed` toggle semantics, so
 * the group is left as pressed-state buttons rather than promoted to radios:
 * each chip genuinely toggles a view on, and only one view can be on.
 */
export function FilterChip({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      {...hoverProps}
      {...focusRing<HTMLButtonElement>()}
      // The design draws a 24px chip, which is under the 44px touch floor. The
      // height is carried as a utility rather than inline so the phone layout
      // can raise it; an inline min-height would win over the media query.
      className="min-h-6 max-sm:min-h-11"
      style={{
        padding: "2px 9px",
        border: `1px solid ${
          active
            ? "var(--accent-border)"
            : hovered && !disabled
              ? "var(--border-strong)"
              : "var(--line)"
        }`,
        background: active ? "var(--accent-soft)" : "var(--surface)",
        color: active ? "var(--accent)" : "var(--text-2)",
        fontWeight: active ? 600 : 400,
        borderRadius: 999,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        outline: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/** Muted tabular count that trails a chip label. */
export function ChipCount({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        marginLeft: 5,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
}

/* ── Small ghost button ───────────────────────────────────────────────────── */

/** 24px-tall control used for the trailing action in a crawl history row. */
export function SmallGhostButton({
  onClick,
  muted,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  /** The design draws the Stop instance a step quieter than Compare/Details. */
  muted?: boolean;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...hoverProps}
      {...focusRing<HTMLButtonElement>()}
      // See FilterChip: the touch floor has to beat the design's 24px, so the
      // height is a utility rather than an inline style.
      className="min-h-6 max-sm:min-h-11"
      style={{
        padding: "2px 9px",
        border: `1px solid ${
          hovered && !disabled ? "var(--border-strong)" : "var(--line)"
        }`,
        background: "var(--surface)",
        color: muted ? "var(--text-2)" : "var(--text)",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        outline: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/* ── Chevron ──────────────────────────────────────────────────────────────── */

/**
 * The design's row affordance is the literal character U+203A, not a sprite
 * icon. Kept verbatim; it turns a quarter when its row is expanded.
 */
export function RowChevron({ open }: { open?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        color: "var(--text-3)",
        display: "inline-block",
        transform: open ? "rotate(90deg)" : undefined,
        transition: "transform 120ms ease",
      }}
    >
      &#8250;
    </span>
  );
}

/* ── Sortable table headers ───────────────────────────────────────────────── */

type SortState<K extends string> = { key: K; desc: boolean };

/** Column sort state, shared by both tables on this screen. */
export function useSort<K extends string>(initial: K) {
  const [sort, setSort] = useState<SortState<K>>({ key: initial, desc: false });
  return {
    sort,
    toggle: (key: K) =>
      setSort((current) => ({
        key,
        desc: current.key === key ? !current.desc : false,
      })),
  };
}

/**
 * Compare two values that may not have been measured.
 *
 * Unmeasured sorts last in both directions: a page with no Lighthouse run is
 * not the fastest page on the site.
 */
export function compareNullable(
  a: number | null,
  b: number | null,
  direction: number,
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction * (a - b);
}

/**
 * Sortable column header.
 *
 * The design draws uppercase headers that look sortable and are not. Sorting is
 * a working behaviour of these tables, so the headers get the handler and the
 * `aria-sort` their look already implies.
 */
export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  lead,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  /** True for the column whose left edge sits on the page gutter. */
  lead?: boolean;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      style={lead ? TH_LEAD : TH_NUMERIC}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        {...focusRing<HTMLButtonElement>()}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          font: "inherit",
          color: active ? "var(--text-2)" : "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {label}
        <span aria-hidden style={{ marginLeft: 4, opacity: active ? 1 : 0 }}>
          {sort.desc ? "↓" : "↑"}
        </span>
      </button>
    </th>
  );
}

/* ── Loading, empty and error ─────────────────────────────────────────────── */

/**
 * Skeleton block. The design has no loading state anywhere on this screen; a
 * crawl of a thousand pages is not a fast read, so one is built rather than
 * leaving the panel blank.
 */
export function Skeleton({
  width,
  height = 11,
  style,
}: {
  width: number | string;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width,
        height,
        borderRadius: 4,
        background: "var(--inset)",
        ...style,
      }}
    />
  );
}

/** Placeholder rows shaped like the issue list, shown while results load. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "13px var(--pad, 24px)",
            borderBottom: "1px solid var(--border-muted)",
          }}
        >
          <Skeleton width={7} height={7} style={{ borderRadius: 999 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton width={`${38 + ((index * 13) % 22)}%`} height={12} />
            <Skeleton
              width={`${58 + ((index * 17) % 25)}%`}
              height={10}
              style={{ marginTop: 6 }}
            />
          </div>
          <Skeleton width={44} height={10} />
        </div>
      ))}
    </div>
  );
}

/**
 * Honest blank state.
 *
 * Used for both "nothing here" and "we never measured this". It never renders
 * a zero in place of an absent measurement.
 */
export function PanelMessage({
  title,
  children,
  tone = "neutral",
}: {
  title: ReactNode;
  children?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      style={{
        padding: "34px var(--pad, 24px)",
        textAlign: "center",
        color: "var(--text-2)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          color: tone === "danger" ? "var(--danger)" : "var(--text)",
        }}
      >
        {title}
      </p>
      {children ? (
        <p
          style={{
            margin: "5px auto 0",
            fontSize: 12.5,
            maxWidth: 460,
          }}
        >
          {children}
        </p>
      ) : null}
    </div>
  );
}

const BAND_TONE = {
  warning: {
    fg: "var(--warning)",
    bg: "var(--warning-soft)",
    bd: "var(--warning-border)",
  },
  danger: {
    fg: "var(--danger)",
    bg: "var(--danger-soft)",
    bd: "var(--danger-border)",
  },
} as const;

/**
 * Full-bleed band under the header for something the operator must know about
 * this crawl: pages the site refused us, or a run that stopped early.
 */
export function NoticeBand({
  tone,
  title,
  children,
}: {
  tone: keyof typeof BAND_TONE;
  title: ReactNode;
  children?: ReactNode;
}) {
  const palette = BAND_TONE[tone];
  return (
    <div
      role="status"
      style={{
        padding: "10px var(--pad, 24px)",
        background: palette.bg,
        borderBottom: `1px solid ${palette.bd}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          fontWeight: 600,
          color: palette.fg,
        }}
      >
        {title}
      </p>
      {children ? (
        <p
          style={{
            margin: "3px 0 0",
            fontSize: 12.5,
            color: "var(--text-2)",
            maxWidth: 720,
          }}
        >
          {children}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Provenance line under a panel. Every figure on this screen comes from our own
 * crawler or from PageSpeed Insights, and the screen says which.
 */
export function PanelFootnote({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-2)" }}>
      {children}
    </p>
  );
}
