import type { ReactNode } from "react";
import { Icon } from "@/client/components/icons/IconSprite";
import { LinkButton } from "@/client/features/onboarding/onboardingControls";

export type StepStatus = "todo" | "active" | "done" | "skipped";

const STATUS_WORD: Record<StepStatus, string> = {
  todo: "Not started",
  active: "In progress",
  done: "Done",
  skipped: "Skipped",
};

/**
 * One row of the get-started checklist.
 *
 * Only the active step expands: it shows its description at reading weight
 * plus its controls, while every other row collapses to a single line stating
 * what happened. The badge carries the same three presentations the design
 * draws (numbered ring, accent ring, filled check).
 */
export function OnboardingStepRow({
  number,
  title,
  status,
  description,
  doneLine,
  skippedLine,
  onResume,
  tinted = false,
  trailing,
  children,
}: {
  number: number;
  title: ReactNode;
  status: StepStatus;
  /** Shown dimmed while queued, and at reading weight while active. */
  description: ReactNode;
  doneLine?: ReactNode;
  skippedLine?: ReactNode;
  /** Reopens a skipped step. */
  onResume?: () => void;
  /** The design tints the first row and drops the ring from its badge. */
  tinted?: boolean;
  /** Right-hand slot, used for the design's "Change" button. */
  trailing?: ReactNode;
  /** The step's controls, rendered only while it is active. */
  children?: ReactNode;
}) {
  const done = status === "done";

  return (
    <li
      style={{
        padding: "12px 13px",
        borderBottom: "1px solid var(--border-muted)",
        ...(tinted ? { background: "var(--subtle)" } : null),
      }}
    >
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <StepBadge number={number} status={status} ringed={!tinted} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color:
                done || status === "active" ? "var(--text)" : "var(--text-2)",
            }}
          >
            {title}
            <span className="sr-only">{`. ${STATUS_WORD[status]}.`}</span>
          </div>

          {done ? (
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
              {doneLine}
            </div>
          ) : null}

          {status === "skipped" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 3,
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              <span>{skippedLine}</span>
              {onResume ? (
                <LinkButton onClick={onResume}>Do it now</LinkButton>
              ) : null}
            </div>
          ) : null}

          {status === "todo" ? (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              {description}
            </div>
          ) : null}

          {status === "active" ? (
            <>
              <p
                style={{
                  margin: "3px 0 9px",
                  fontSize: 12.5,
                  color: "var(--text-2)",
                }}
              >
                {description}
              </p>
              {children}
            </>
          ) : null}
        </div>
        {trailing}
      </div>
    </li>
  );
}

function StepBadge({
  number,
  status,
  ringed,
}: {
  number: number;
  status: StepStatus;
  ringed: boolean;
}) {
  const done = status === "done";
  const tone = done
    ? {
        background: "var(--success)",
        color: "var(--text-inv)",
        border: ringed ? "1px solid var(--success)" : undefined,
      }
    : status === "active"
      ? {
          background: "transparent",
          color: "var(--accent)",
          border: "1px solid var(--accent)",
        }
      : {
          background: "transparent",
          color: "var(--text-3)",
          border: "1px solid var(--border-strong)",
        };

  return (
    <span
      aria-hidden
      style={{
        width: 19,
        height: 19,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
        ...tone,
      }}
    >
      {done ? (
        // The design thickens the check to 2.4 so it holds up at 11px on the
        // filled circle.
        <Icon name="i-check" size={11} style={{ strokeWidth: 2.4 }} />
      ) : (
        number
      )}
    </span>
  );
}
