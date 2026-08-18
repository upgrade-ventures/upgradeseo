import type { ReactNode } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { NoValue } from "@/client/components/prominence/Primitives";

/**
 * A value the free stack cannot produce.
 *
 * The reason string comes from the server (`free.unavailable`), which names the
 * missing source and what would fix it. It is exposed as a title and to
 * assistive tech, so the dash is never a mystery. A zero or an "N/A" here would
 * be a claim we have no measurement for.
 */
export function Unavailable({ reason }: { reason?: string }) {
  return (
    <span
      title={reason}
      aria-label={reason ? `Unavailable. ${reason}` : "Unavailable"}
      style={{ cursor: reason ? "help" : "default" }}
    >
      <NoValue />
    </span>
  );
}

type NoticeTone = "info" | "warning" | "danger";

const NOTICE_TONE: Record<NoticeTone, { fg: string; bg: string; bd: string }> =
  {
    info: {
      fg: "var(--info)",
      bg: "var(--info-soft)",
      bd: "var(--info-border)",
    },
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
  };

/**
 * A full-width explanation strip: provenance for the numbers below it, or the
 * reason a lookup produced nothing.
 */
export function NoticeStrip({
  tone = "info",
  title,
  children,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children: ReactNode;
}) {
  const t = NOTICE_TONE[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        margin: "12px var(--pad, 24px)",
        padding: "9px 12px",
        border: `1px solid ${t.bd}`,
        background: t.bg,
        borderRadius: 8,
        fontSize: 12.5,
        color: "var(--text)",
      }}
    >
      <span style={{ color: t.fg, display: "flex", paddingTop: 1 }}>
        <Icon name={tone === "info" ? "i-help" : "i-alert"} size={14} />
      </span>
      <span style={{ minWidth: 0 }}>
        {title ? (
          <strong style={{ fontWeight: 600 }}>
            {title}
            {". "}
          </strong>
        ) : null}
        {children}
      </span>
    </div>
  );
}

/**
 * What a table shows when a query legitimately returns nothing. Sits inside the
 * table shell so the column rules stay put.
 */
export function TableEmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "34px var(--pad, 24px)",
        textAlign: "center",
        color: "var(--text-2)",
        fontSize: 12.5,
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
