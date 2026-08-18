import type { CSSProperties, ReactNode } from "react";
import {
  JobStatusPill,
  type JobState,
} from "@/client/components/prominence/JobStatus";

/**
 * The live progress row a long-running action shows while it runs.
 *
 * The status vocabulary itself lives in `JobStatus.tsx` and is used here, not
 * restated. The geometry is the Dashboard's "In progress" card: name and count
 * on one line, a 4px track under it, and a sentence saying the reader may
 * leave. Nothing invents a number — a caller with no measured count passes
 * `null` and gets a track with no width claim rather than a zero.
 */

/* ── Progress ─────────────────────────────────────────────────────────────── */

/** The design's ring spinner. */
function JobSpinner({
  size = 12,
  color = "var(--info)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        animation: "spin 1s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

/**
 * One running or queued job: what it is, how far it has got, and what the
 * reader may do about it.
 *
 * `done` and `total` are the live count. When the total is not yet known the
 * bar renders as a flat track rather than filling to a percentage nobody
 * measured, and the count line says so.
 */
export function JobProgressRow({
  name,
  reference,
  status,
  done,
  total,
  unit,
  note,
  action,
  style,
}: {
  name: ReactNode;
  /** The job's own id, shown in tabular figures beside the name. */
  reference?: ReactNode;
  status: JobState;
  done: number | null;
  total: number | null;
  /** What is being counted: "pages", "keywords", "checks". */
  unit: string;
  note?: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
}) {
  const running = status === "running";
  const percent =
    done !== null && total !== null && total > 0
      ? Math.min(100, Math.round((done / total) * 100))
      : null;

  return (
    <div
      // Live because the count changes underneath the reader while they watch.
      role="status"
      aria-live="polite"
      style={{ padding: "11px 12px", ...style }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {running ? <JobSpinner /> : null}
          <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
          {reference ? (
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.01em",
                fontSize: 11.5,
                color: "var(--text-3)",
              }}
            >
              {reference}
            </span>
          ) : null}
        </div>
        {running ? (
          <span
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {done === null
              ? `Counting ${unit}`
              : total === null
                ? `${done.toLocaleString()} ${unit} so far`
                : `${done.toLocaleString()} / ${total.toLocaleString()} ${unit}`}
          </span>
        ) : (
          <JobStatusPill state={status} />
        )}
      </div>

      {running ? (
        <div
          role="progressbar"
          aria-label={`${unit} completed`}
          aria-valuemin={percent === null ? undefined : 0}
          aria-valuemax={percent === null ? undefined : 100}
          aria-valuenow={percent ?? undefined}
          style={{
            marginTop: 8,
            height: 4,
            borderRadius: 999,
            background: "var(--inset)",
            overflow: "hidden",
          }}
        >
          {percent === null ? null : (
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "var(--info)",
                transition: "width 300ms ease",
              }}
            />
          )}
        </div>
      ) : null}

      {note ? (
        <p style={{ margin: "7px 0 0", fontSize: 12, color: "var(--text-2)" }}>
          {note}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}
